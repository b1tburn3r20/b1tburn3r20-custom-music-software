// Pure migration functions (no fs / electron) so they can be unit tested
// against copies of real data. Nothing here ever drops user data: anything that
// can't be resolved is kept in an `unresolved` list and surfaced in a report.
const path = require("path");
const { splitArtists } = require("../lib/artists.cjs");
const { formatDuration, sourceIdFromFileName } = require("../lib/media.cjs");

const LIBRARY_VERSION = 6;
const USER_VERSION = 1;

const DEFAULT_SETTINGS = Object.freeze({
  theme: "red-dark",
  volume: 50,
  repeat: "all", // 'off' | 'all' | 'one'
  shuffle: false,
  autoplayRadio: true,
  expandOnPlay: false,
  zenMode: true,
  zenTimeout: 3000,
  playerBackground: "visualizer", // 'artwork' | 'visualizer' (full-screen player)
  visualizer: "orbit", // a scene id, or 'cycle' for a different one each song
  visualizerOffsetMs: 0, // extra visual delay on top of the reported output latency (Bluetooth etc.)
  youtubeAuth: { mode: "none", browser: "firefox", profile: "" },
  ytDlpSkippedVersion: null, // a yt-dlp release the user chose not to be asked about again
  onboarding: { status: "pending", step: "folder" },
  youtubeCardDismissed: false, // the optional "set up YouTube" card on Home
  aiProvider: "anthropic", // 'anthropic' | 'openai': which one tags songs. Keys are stored separately, encrypted.
  aiTier: "low", // 'low' | 'medium' | 'high'
});

function emptyUserState() {
  return {
    version: USER_VERSION,
    playlists: [],
    likes: [],
    recentlyPlayed: [],
    recentlyDownloaded: [],
    /** songId -> when it was downloaded (ms). Older downloads have no entry. */
    downloadedAt: {},
    recentPlaylists: [],
    /** songId -> your own tags (moods/genres), e.g. ["somber", "rap"] */
    songTags: {},
    settings: { ...DEFAULT_SETTINGS, youtubeAuth: { ...DEFAULT_SETTINGS.youtubeAuth } },
    legacyImports: {},
    legacyUnresolved: [],
    notices: [],
  };
}

function emptyLibrary() {
  return { version: LIBRARY_VERSION, rootDir: null, songs: {} };
}

function thumbFileFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  return path.basename(url.replace(/^file:\/\//, ""));
}

function normalizeMetadata(m = {}, fileName = "") {
  const artist = m.artist || "Unknown Artist";
  const duration = Number(m.duration) || 0;
  return {
    title: m.title || fileName.replace(/\.mp3$/i, ""),
    artist,
    artists: Array.isArray(m.artists) ? m.artists : splitArtists(artist),
    album: m.album && m.album !== "Unknown Album" ? m.album : null,
    albumArtist: m.albumArtist || (m.channel && m.channel !== artist && m.channel !== "Unknown" ? m.channel : null),
    duration,
    durationFormatted: formatDuration(duration),
    year: m.year || null,
    genre: m.genre || null,
    description: m.description || "",
    uploadDate: m.uploadDate || "",
  };
}

/**
 * music-cache.json v4 ({version, songCache:{rootDir, songs:[{name,path,metadata}]}})
 * -> library v5 keyed by a stable id.
 */
function migrateLegacyLibrary(legacy, { newId }) {
  const lib = emptyLibrary();
  const report = { songs: 0, skipped: [] };
  const cache = legacy && (legacy.songCache || legacy);
  if (!cache || !Array.isArray(cache.songs)) return { library: lib, report };
  lib.rootDir = cache.rootDir || null;
  const seenPaths = new Set();
  for (const s of cache.songs) {
    if (!s || typeof s.path !== "string") {
      report.skipped.push({ reason: "no path", entry: s && s.name });
      continue;
    }
    if (seenPaths.has(s.path)) continue;
    seenPaths.add(s.path);
    const id = newId();
    const fileName = s.name || path.basename(s.path);
    lib.songs[id] = {
      id,
      path: s.path,
      fileName,
      size: null,
      mtime: null,
      fingerprint: null,
      sourceId: sourceIdFromFileName(fileName),
      thumbnailFile: thumbFileFromUrl(s.metadata && s.metadata.thumbnail),
      addedAt: null,
      missing: false,
      metadata: normalizeMetadata(s.metadata, fileName),
    };
    report.songs++;
  }
  return { library: lib, report };
}

/**
 * v5 → v6: an earlier build linked pre-overhaul files to YouTube videos by title
 * alone, so two different songs with the same title could share an id (e.g. two
 * "JUMP"s). Keep only ids that come from the file name ("Title [id].mp3"); the
 * stricter matcher re-links the rest safely.
 */
function repairGuessedSourceIds(lib) {
  const cleared = [];
  for (const s of Object.values(lib.songs)) {
    if (s.sourceId && !String(s.fileName || "").includes(`[${s.sourceId}]`)) {
      cleared.push({ id: s.id, title: s.metadata ? s.metadata.title : s.fileName, sourceId: s.sourceId });
      // Remember which song wrongly held this id, so playlist entries can be corrected later.
      lib.clearedSourceIds = { ...(lib.clearedSourceIds || {}), [s.sourceId]: s.id };
      s.sourceId = sourceIdFromFileName(s.fileName || "");
    }
  }
  lib.version = 6;
  return cleared;
}

function pathIndex(library) {
  const m = new Map();
  for (const s of Object.values(library.songs)) m.set(s.path, s.id);
  return m;
}

function uniqueName(name, taken) {
  let candidate = name;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) candidate = `${name} (${n++})`;
  taken.add(candidate.toLowerCase());
  return candidate;
}

/** playlists.json ({playlists:[{id,name,description,created,updated,songs:[path]}]}) -> user.playlists */
function migrateLegacyPlaylists(legacy, pathToId) {
  const report = { playlists: 0, songs: 0, unresolved: [], duplicateSongsRemoved: 0, renamed: [] };
  const out = [];
  const taken = new Set();
  const list = (legacy && Array.isArray(legacy.playlists)) ? legacy.playlists : [];
  for (const pl of list) {
    if (!pl || !pl.id) continue;
    const songIds = [];
    const unresolvedPaths = [];
    const seen = new Set();
    for (const p of pl.songs || []) {
      const songPath = typeof p === "string" ? p : p && p.path;
      const id = pathToId.get(songPath);
      if (!id) {
        unresolvedPaths.push(songPath);
        report.unresolved.push({ playlist: pl.name, path: songPath });
        continue;
      }
      if (seen.has(id)) {
        report.duplicateSongsRemoved++;
        continue;
      }
      seen.add(id);
      songIds.push(id);
    }
    const originalName = (pl.name || "").trim() || "Untitled playlist";
    const name = uniqueName(originalName, taken);
    if (name !== originalName) report.renamed.push({ from: originalName, to: name });
    out.push({
      id: pl.id,
      name,
      description: (pl.description || "").trim(),
      created: pl.created || Date.now(),
      updated: pl.updated || Date.now(),
      songIds,
      ...(unresolvedPaths.length ? { unresolvedPaths } : {}),
    });
    report.playlists++;
    report.songs += songIds.length;
  }
  return { playlists: out, report };
}

function parseLs(raw) {
  if (raw == null) return null;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

const REPEAT_MAP = { loopPlaylist: "all", loopSong: "one", off: "off", noLoop: "off" };

/**
 * Merge one renderer origin's localStorage dump into the user state.
 * Runs once per origin (tracked in user.legacyImports) so a later unlike is
 * never undone by a re-import.
 */
function importRendererLegacy(user, dump, { origin, pathToId, playlistIds, now }) {
  const report = { origin, skipped: false, likes: 0, recentlyPlayed: 0, recentlyDownloaded: 0, recentPlaylists: 0, unresolved: [], suspectedLikesCorruption: false };
  if (user.legacyImports[origin]) {
    report.skipped = true;
    return { user, report };
  }
  const next = structuredClone(user);
  const resolve = (entry, kind) => {
    const p = entry && (typeof entry === "string" ? entry : entry.path);
    const id = p && pathToId.get(p);
    if (!id) {
      const item = { kind, path: p || null, title: entry && entry.metadata ? entry.metadata.title : null };
      report.unresolved.push(item);
      next.legacyUnresolved.push({ ...item, origin });
    }
    return id || null;
  };
  const asArray = (v) => (Array.isArray(v) ? v : []);

  // Likes
  const likedIds = new Set(next.likes.map((l) => l.songId));
  const importedLikes = [];
  for (const s of asArray(parseLs(dump.likedSongs))) {
    const id = resolve(s, "like");
    if (id && !likedIds.has(id)) {
      likedIds.add(id);
      importedLikes.push({ songId: id, likedAt: now });
      report.likes++;
    }
  }
  next.likes.push(...importedLikes);

  // Recently played (no timestamps in legacy data)
  const rpSeen = new Set(next.recentlyPlayed.map((r) => r.songId));
  for (const s of asArray(parseLs(dump.recentlyPlayed))) {
    const id = resolve(s, "recentlyPlayed");
    if (id && !rpSeen.has(id)) {
      rpSeen.add(id);
      next.recentlyPlayed.push({ songId: id, playedAt: null, legacy: true });
      report.recentlyPlayed++;
    }
  }

  // Recently downloaded
  const rdSeen = new Set(next.recentlyDownloaded);
  const downloadedIds = [];
  for (const s of asArray(parseLs(dump.userRecentlyDownloaded))) {
    const id = resolve(s, "recentlyDownloaded");
    if (id) downloadedIds.push(id);
    if (id && !rdSeen.has(id)) {
      rdSeen.add(id);
      next.recentlyDownloaded.push(id);
      report.recentlyDownloaded++;
    }
  }

  // Recently played playlists
  const rplSeen = new Set(next.recentPlaylists);
  for (const p of asArray(parseLs(dump.userRecentlyPlayedPlaylists))) {
    const id = p && (typeof p === "string" ? p : p.id);
    if (id && playlistIds.has(id) && !rplSeen.has(id)) {
      rplSeen.add(id);
      next.recentPlaylists.push(id);
      report.recentPlaylists++;
    }
  }

  // Detect the old bug that copied "recently downloaded" into likes on delete.
  if (importedLikes.length > 0 && downloadedIds.length > 0) {
    const dl = new Set(downloadedIds);
    const overlap = importedLikes.filter((l) => dl.has(l.songId)).length;
    report.likesAlsoInDownloads = overlap;
    // The bug replaced likes wholesale, so later real likes add only a few extras.
    const looksCopied = overlap / importedLikes.length >= 0.9 && (importedLikes.length >= 5 || overlap === importedLikes.length);
    if (looksCopied && importedLikes.length >= Math.min(3, dl.size)) {
      report.suspectedLikesCorruption = true;
      next.notices.push({
        id: `likes-corruption-${origin}`,
        createdAt: now,
        message:
          `${overlap} of your ${importedLikes.length} imported Liked Songs are also in your recent downloads. An old bug overwrote Likes with the downloads list whenever a song was deleted, so many of these were probably never liked by you. Nothing was removed. Please review Liked Songs.`,
      });
    }
  }

  // Settings
  const s = next.settings;
  const vol = Number(parseLs(dump.musicVolume));
  if (Number.isFinite(vol) && vol >= 0 && vol <= 100) s.volume = vol;
  const rep = REPEAT_MAP[parseLs(dump.userLoopingPreferance)];
  if (rep) s.repeat = rep;
  const eop = parseLs(dump.userSettingExpandOnPlayToggle);
  if (typeof eop === "boolean") s.expandOnPlay = eop;
  const zen = parseLs(dump.userSettingZenModeToggle);
  if (typeof zen === "boolean") s.zenMode = zen;
  const zt = Number(parseLs(dump.userSettingZenModeTimout));
  if (Number.isFinite(zt) && zt > 0) s.zenTimeout = zt;

  next.legacyImports[origin] = { importedAt: now, report: { ...report, unresolved: report.unresolved.length } };
  return { user: next, report };
}

module.exports = {
  LIBRARY_VERSION,
  USER_VERSION,
  DEFAULT_SETTINGS,
  emptyUserState,
  emptyLibrary,
  normalizeMetadata,
  migrateLegacyLibrary,
  repairGuessedSourceIds,
  migrateLegacyPlaylists,
  importRendererLegacy,
  pathIndex,
};
