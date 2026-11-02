// User store: playlists, likes, recents and settings, all referencing songs by id.
// Every mutation goes through here so main is the single source of truth and the
// renderer only mirrors it (via the "user:changed" event).
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const { readJson, writeJsonAtomic, createDebouncedSaver } = require("../lib/atomic.cjs");
const { USER_VERSION, DEFAULT_SETTINGS, emptyUserState, migrateLegacyPlaylists, importRendererLegacy } = require("./migrate.cjs");
const { backupFiles } = require("./paths.cjs");

const LIMITS = { recentlyPlayed: 100, recentlyDownloaded: 200, recentPlaylists: 20, nameLength: 100, descriptionLength: 500 };
const SETTINGS_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));

class UserError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function createUserStore({ userData, library, emit = () => { } }) {
  const file = path.join(userData, "user.json");
  let user = emptyUserState();
  const saver = createDebouncedSaver(() => writeJsonAtomic(file, user), 250);

  const commit = () => {
    saver.schedule();
    emit(snapshot());
  };
  const snapshot = () => ({
    playlists: user.playlists,
    likes: user.likes,
    recentlyPlayed: user.recentlyPlayed,
    recentlyDownloaded: user.recentlyDownloaded,
    recentPlaylists: user.recentPlaylists,
    settings: user.settings,
    notices: user.notices,
    legacyUnresolved: user.legacyUnresolved,
  });

  async function load() {
    const report = { migrated: false };
    let data = null;
    try {
      data = await readJson(file, null);
    } catch (err) {
      const aside = `${file}.corrupt-${Date.now()}`;
      await fs.copyFile(file, aside).catch(() => { });
      console.error(`[user] user.json unreadable (${err.message}); copied to ${aside}`);
    }
    if (data && data.version > USER_VERSION) throw new Error(`user.json is from a newer app version (v${data.version})`);
    if (data) {
      const base = emptyUserState();
      user = { ...base, ...data, settings: { ...base.settings, ...data.settings, youtubeAuth: { ...base.settings.youtubeAuth, ...(data.settings && data.settings.youtubeAuth) } } };
      return report;
    }
    const legacy = await readJson(path.join(userData, "playlists.json"), null).catch((e) => {
      console.error("[user] legacy playlists.json unreadable:", e.message);
      return null;
    });
    if (legacy) {
      report.backup = await backupFiles(userData, ["playlists.json"], "user-v1");
      const { playlists, report: r } = migrateLegacyPlaylists(legacy, library.pathToId());
      user.playlists = playlists;
      report.migrated = true;
      report.playlists = r;
      console.info(`[user] migrated ${r.playlists} playlists (${r.songs} songs, ${r.unresolved.length} unresolved, renamed: ${r.renamed.length})`);
    }
    await writeJsonAtomic(file, user);
    return report;
  }

  // ---------- playlists ----------
  const findPlaylist = (id) => {
    const pl = user.playlists.find((p) => p.id === id);
    if (!pl) throw new UserError("PLAYLIST_NOT_FOUND", "That playlist no longer exists.");
    return pl;
  };

  function validateName(name, exceptId = null) {
    const trimmed = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
    if (!trimmed) throw new UserError("NAME_REQUIRED", "Please give the playlist a name.");
    if (trimmed.length > LIMITS.nameLength) throw new UserError("NAME_TOO_LONG", `Playlist names can be at most ${LIMITS.nameLength} characters.`);
    const clash = user.playlists.find((p) => p.id !== exceptId && p.name.toLowerCase() === trimmed.toLowerCase());
    if (clash) throw new UserError("NAME_TAKEN", `You already have a playlist called "${clash.name}".`);
    return trimmed;
  }

  function createPlaylist({ name, description = "", songIds = [], source = null }) {
    const now = Date.now();
    const pl = {
      id: `playlist-${crypto.randomUUID()}`,
      name: validateName(name),
      description: String(description || "").trim().slice(0, LIMITS.descriptionLength),
      created: now,
      updated: now,
      songIds: [],
      ...(source ? { source } : {}),
    };
    user.playlists.push(pl);
    if (songIds.length) addSongs(pl.id, songIds, { silent: true });
    commit();
    return pl;
  }

  /** Local playlist that mirrors a YouTube playlist (created on first download, reused after). */
  function ensureMirrorPlaylist(youtubeId, title) {
    const existing = user.playlists.find((p) => p.source && p.source.type === "youtube" && p.source.id === youtubeId);
    if (existing) return existing;
    const taken = new Set(user.playlists.map((p) => p.name.toLowerCase()));
    const base = String(title || "YouTube playlist").trim().slice(0, LIMITS.nameLength - 16) || "YouTube playlist";
    let name = base;
    for (let n = 1; taken.has(name.toLowerCase()); n++) name = n === 1 ? `${base} (YouTube)` : `${base} (YouTube ${n})`;
    return createPlaylist({ name, description: "Downloaded from YouTube", source: { type: "youtube", id: youtubeId } });
  }

  function updatePlaylist(id, { name, description }) {
    const pl = findPlaylist(id);
    if (name !== undefined) pl.name = validateName(name, id);
    if (description !== undefined) pl.description = String(description || "").trim().slice(0, LIMITS.descriptionLength);
    pl.updated = Date.now();
    commit();
    return pl;
  }

  function deletePlaylist(id) {
    findPlaylist(id);
    user.playlists = user.playlists.filter((p) => p.id !== id);
    user.recentPlaylists = user.recentPlaylists.filter((p) => p !== id);
    commit();
    return true;
  }

  function addSongs(id, songIds, { silent = false } = {}) {
    const pl = findPlaylist(id);
    const present = new Set(pl.songIds);
    const result = { added: [], duplicates: [], invalid: [] };
    for (const sid of songIds) {
      if (!library.hasSong(sid)) result.invalid.push(sid);
      else if (present.has(sid)) result.duplicates.push(sid);
      else {
        present.add(sid);
        pl.songIds.push(sid);
        result.added.push(sid);
      }
    }
    if (result.added.length) pl.updated = Date.now();
    if (!silent) commit();
    return result;
  }

  /** Add one song to several playlists in a single write. */
  function addSongToPlaylists(songId, playlistIds) {
    const out = { added: [], duplicates: [], missing: [] };
    for (const pid of playlistIds) {
      const pl = user.playlists.find((p) => p.id === pid);
      if (!pl) {
        out.missing.push(pid);
        continue;
      }
      const r = addSongs(pid, [songId], { silent: true });
      if (r.invalid.length) throw new UserError("SONG_NOT_FOUND", "That song is no longer in your library.");
      (r.added.length ? out.added : out.duplicates).push(pid);
    }
    commit();
    return out;
  }

  function removeSongFromPlaylist(id, songId) {
    const pl = findPlaylist(id);
    const before = pl.songIds.length;
    pl.songIds = pl.songIds.filter((s) => s !== songId);
    if (pl.songIds.length === before) throw new UserError("NOT_IN_PLAYLIST", "That song isn't in this playlist.");
    pl.updated = Date.now();
    commit();
    return true;
  }

  function reorderPlaylist(id, songIds) {
    const pl = findPlaylist(id);
    const a = [...pl.songIds].sort();
    const b = [...songIds].sort();
    if (a.length !== b.length || a.some((x, i) => x !== b[i])) throw new UserError("BAD_ORDER", "Reorder must contain the same songs.");
    pl.songIds = [...songIds];
    pl.updated = Date.now();
    commit();
    return true;
  }

  // ---------- likes / recents ----------
  function setLiked(songId, liked) {
    const has = user.likes.some((l) => l.songId === songId);
    if (liked && !has) {
      if (!library.hasSong(songId)) throw new UserError("SONG_NOT_FOUND", "That song is no longer in your library.");
      user.likes.unshift({ songId, likedAt: Date.now() });
    } else if (!liked && has) {
      user.likes = user.likes.filter((l) => l.songId !== songId);
    } else return liked;
    commit();
    return liked;
  }

  function recordRecentlyPlayed(songId) {
    if (!library.hasSong(songId)) return;
    user.recentlyPlayed = [{ songId, playedAt: Date.now() }, ...user.recentlyPlayed.filter((r) => r.songId !== songId)].slice(0, LIMITS.recentlyPlayed);
    commit();
  }

  function recordRecentPlaylist(playlistId) {
    if (!user.playlists.some((p) => p.id === playlistId)) return;
    user.recentPlaylists = [playlistId, ...user.recentPlaylists.filter((p) => p !== playlistId)].slice(0, LIMITS.recentPlaylists);
    commit();
  }

  function addRecentlyDownloaded(songId) {
    user.recentlyDownloaded = [songId, ...user.recentlyDownloaded.filter((s) => s !== songId)].slice(0, LIMITS.recentlyDownloaded);
    commit();
  }

  /** Remove every reference to a song (used when the song is deleted). */
  function purgeSongs(songIds) {
    const ids = new Set(songIds);
    let touched = 0;
    for (const pl of user.playlists) {
      const before = pl.songIds.length;
      pl.songIds = pl.songIds.filter((s) => !ids.has(s));
      if (pl.songIds.length !== before) {
        pl.updated = Date.now();
        touched++;
      }
    }
    user.likes = user.likes.filter((l) => !ids.has(l.songId));
    user.recentlyPlayed = user.recentlyPlayed.filter((r) => !ids.has(r.songId));
    user.recentlyDownloaded = user.recentlyDownloaded.filter((s) => !ids.has(s));
    commit();
    return touched;
  }

  // ---------- settings ----------
  function updateSettings(patch) {
    for (const [k, v] of Object.entries(patch || {})) {
      if (!SETTINGS_KEYS.has(k)) continue;
      if (k === "youtubeAuth") user.settings.youtubeAuth = { ...user.settings.youtubeAuth, ...v };
      else user.settings[k] = v;
    }
    commit();
    return user.settings;
  }

  function importLegacy(dump, origin) {
    const { user: next, report } = importRendererLegacy(user, dump || {}, {
      origin,
      pathToId: library.pathToId(),
      playlistIds: new Set(user.playlists.map((p) => p.id)),
      now: Date.now(),
    });
    if (!report.skipped) {
      user = next;
      commit();
      console.info(`[user] imported legacy renderer data from ${origin}:`, { ...report, unresolved: report.unresolved.length });
    }
    return report;
  }

  function dismissNotice(id) {
    user.notices = user.notices.filter((n) => n.id !== id);
    commit();
  }

  /** References to songs that are not in the library (for the orphan report). */
  function danglingReferences() {
    const bad = (id) => !library.hasSong(id);
    return {
      playlists: user.playlists.map((p) => ({ id: p.id, name: p.name, songIds: p.songIds.filter(bad) })).filter((p) => p.songIds.length),
      likes: user.likes.filter((l) => bad(l.songId)).map((l) => l.songId),
      recentlyPlayed: user.recentlyPlayed.filter((r) => bad(r.songId)).map((r) => r.songId),
      recentlyDownloaded: user.recentlyDownloaded.filter(bad),
    };
  }

  /** Remove references to songs that no longer exist in the library. */
  function removeDangling() {
    const d = danglingReferences();
    const ids = new Set([...d.playlists.flatMap((p) => p.songIds), ...d.likes, ...d.recentlyPlayed, ...d.recentlyDownloaded]);
    if (ids.size) purgeSongs([...ids]);
    return ids.size;
  }

  return {
    load,
    snapshot,
    removeDangling,
    get settings() {
      return user.settings;
    },
    createPlaylist,
    ensureMirrorPlaylist,
    updatePlaylist,
    deletePlaylist,
    addSongs,
    addSongToPlaylists,
    removeSongFromPlaylist,
    reorderPlaylist,
    setLiked,
    recordRecentlyPlayed,
    recordRecentPlaylist,
    addRecentlyDownloaded,
    purgeSongs,
    updateSettings,
    importLegacy,
    dismissNotice,
    danglingReferences,
    flush: () => saver.flush(),
  };
}

module.exports = { createUserStore, UserError };
