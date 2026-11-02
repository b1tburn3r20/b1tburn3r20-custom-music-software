// Library store: the set of audio files, each with a stable unique id.
// Songs are never identified by title or filename. Ids survive rescans,
// renames and moves (re-linked by path, then by content fingerprint).
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const { readJson, writeJsonAtomic, createDebouncedSaver, exists } = require("../lib/atomic.cjs");
const { AUDIO_EXT_RE, fingerprintFile, readAudioMetadata, sourceIdFromFileName } = require("../lib/media.cjs");
const { LIBRARY_VERSION, emptyLibrary, migrateLegacyLibrary } = require("./migrate.cjs");
const { backupFiles } = require("./paths.cjs");

async function pool(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

function createLibraryStore({ userData, emit = () => { } }) {
  const file = path.join(userData, "library.json");
  const thumbsDir = path.join(userData, "thumbnails");
  let lib = emptyLibrary();
  let scanning = null;
  const saver = createDebouncedSaver(() => writeJsonAtomic(file, lib));

  const songThumbPath = (song) => (song.thumbnailFile ? path.join(thumbsDir, song.thumbnailFile) : null);

  function toPublic(song) {
    const thumb = song.thumbnailFile ? `media://thumb/${song.id}?v=${encodeURIComponent(song.thumbnailFile)}` : null;
    return {
      id: song.id,
      name: song.fileName,
      path: song.path,
      sourceId: song.sourceId || null,
      addedAt: song.addedAt || 0,
      metadata: { ...song.metadata, thumbnail: thumb },
    };
  }

  async function load() {
    const report = { migrated: false };
    let data = null;
    try {
      data = await readJson(file, null);
    } catch (err) {
      // Corrupt file: keep it aside, never overwrite it silently.
      const aside = `${file}.corrupt-${Date.now()}`;
      await fs.copyFile(file, aside).catch(() => { });
      console.error(`[library] library.json unreadable (${err.message}); copied to ${aside}`);
    }
    if (data && data.version === LIBRARY_VERSION) {
      lib = data;
      return report;
    }
    if (data && data.version > LIBRARY_VERSION) {
      throw new Error(`library.json is from a newer app version (v${data.version}); refusing to downgrade`);
    }
    // Migrate from the legacy music-cache.json (v4)
    const legacyPath = path.join(userData, "music-cache.json");
    const legacy = await readJson(legacyPath, null).catch((e) => {
      console.error("[library] legacy music-cache.json unreadable:", e.message);
      return null;
    });
    if (legacy) {
      report.backup = await backupFiles(userData, ["music-cache.json", "playlists.json"], "library-v5");
      const { library, report: r } = migrateLegacyLibrary(legacy, { newId: () => crypto.randomUUID() });
      lib = library;
      report.migrated = true;
      report.songs = r.songs;
      await writeJsonAtomic(file, lib);
      console.info(`[library] migrated ${r.songs} songs from music-cache.json (backup: ${report.backup})`);
    }
    return report;
  }

  const visibleSongs = () => Object.values(lib.songs).filter((s) => !s.missing);
  const getSong = (id) => lib.songs[id] || null;
  const hasSong = (id) => Boolean(lib.songs[id] && !lib.songs[id].missing);
  const pathToId = () => {
    const m = new Map();
    for (const s of Object.values(lib.songs)) m.set(s.path, s.id);
    return m;
  };

  function snapshot() {
    return { rootDir: lib.rootDir, songs: visibleSongs().map(toPublic) };
  }

  async function refreshSongFromFile(song, st, { readTags }) {
    song.size = st.size;
    song.mtime = st.mtimeMs;
    song.fingerprint = await fingerprintFile(song.path, st.size);
    if (!song.addedAt) song.addedAt = Math.round(st.birthtimeMs || st.mtimeMs);
    if (readTags) {
      const coverOut = path.join(thumbsDir, `${song.id}.jpg`);
      const { metadata, hasCover } = await readAudioMetadata(song.path, coverOut);
      song.metadata = metadata;
      if (hasCover) song.thumbnailFile = `${song.id}.jpg`;
    }
  }

  async function doScan(rootDir) {
    const t0 = Date.now();
    const summary = { added: 0, updated: 0, relinked: 0, missing: 0, total: 0 };
    let entries;
    try {
      entries = await fs.readdir(rootDir, { withFileTypes: true });
    } catch (err) {
      throw new Error(`Can't read music folder "${rootDir}": ${err.message}`);
    }
    const files = entries.filter((e) => e.isFile() && AUDIO_EXT_RE.test(e.name)).map((e) => path.join(rootDir, e.name));
    const byPath = pathToId();
    const seen = new Set();
    const fresh = [];

    await pool(files, 6, async (filePath) => {
      let st;
      try {
        st = await fs.stat(filePath);
      } catch {
        return;
      }
      const id = byPath.get(filePath);
      if (!id) {
        fresh.push({ filePath, st });
        return;
      }
      const song = lib.songs[id];
      seen.add(id);
      song.missing = false;
      if (song.size === st.size && song.mtime === st.mtimeMs && song.fingerprint) return;
      // Migrated entries have tags already; only fingerprint them. Changed files get re-read.
      const changed = song.size != null && (song.size !== st.size || song.mtime !== st.mtimeMs);
      try {
        await refreshSongFromFile(song, st, { readTags: changed });
        if (changed) summary.updated++;
      } catch (err) {
        console.warn(`[library] failed to refresh ${path.basename(filePath)}: ${err.message}`);
      }
    });

    // Songs that weren't found by path are candidates for re-linking by fingerprint.
    const candidates = new Map();
    for (const s of Object.values(lib.songs)) {
      if (!seen.has(s.id) && s.fingerprint) candidates.set(s.fingerprint, s);
    }

    await pool(fresh, 6, async ({ filePath, st }) => {
      try {
        const fp = await fingerprintFile(filePath, st.size);
        const match = candidates.get(fp);
        if (match) {
          candidates.delete(fp);
          match.path = filePath;
          match.fileName = path.basename(filePath);
          match.size = st.size;
          match.mtime = st.mtimeMs;
          match.missing = false;
          seen.add(match.id);
          summary.relinked++;
          return;
        }
        const id = crypto.randomUUID();
        const song = {
          id,
          path: filePath,
          fileName: path.basename(filePath),
          size: null,
          mtime: null,
          fingerprint: null,
          sourceId: sourceIdFromFileName(path.basename(filePath)),
          thumbnailFile: null,
          addedAt: null,
          missing: false,
          metadata: null,
        };
        await refreshSongFromFile(song, st, { readTags: true });
        lib.songs[id] = song;
        seen.add(id);
        summary.added++;
      } catch (err) {
        console.warn(`[library] failed to add ${path.basename(filePath)}: ${err.message}`);
      }
    });

    for (const s of Object.values(lib.songs)) {
      if (!seen.has(s.id) && !s.missing) {
        s.missing = true; // hidden from the UI, kept until the user confirms a cleanup
        summary.missing++;
      }
    }
    lib.rootDir = rootDir;
    summary.total = visibleSongs().length;
    await saver.schedule();
    await saver.flush();
    console.info(`[library] scan of ${files.length} files in ${Date.now() - t0}ms`, summary);
    emit({ type: "reset", snapshot: snapshot() });
    return summary;
  }

  function scan(rootDir = lib.rootDir) {
    if (!rootDir) return Promise.resolve({ added: 0, updated: 0, relinked: 0, missing: 0, total: 0 });
    if (scanning) return scanning;
    scanning = doScan(rootDir).finally(() => {
      scanning = null;
    });
    return scanning;
  }

  /** Add or refresh a single file (used after a download). */
  async function addFile(filePath, { sourceId = null } = {}) {
    const st = await fs.stat(filePath);
    const existingId = pathToId().get(filePath);
    let song = existingId ? lib.songs[existingId] : null;
    if (!song) {
      const id = crypto.randomUUID();
      song = {
        id,
        path: filePath,
        fileName: path.basename(filePath),
        size: null,
        mtime: null,
        fingerprint: null,
        sourceId: sourceId || sourceIdFromFileName(path.basename(filePath)),
        thumbnailFile: null,
        addedAt: Date.now(),
        missing: false,
        metadata: null,
      };
      lib.songs[id] = song;
    }
    song.missing = false;
    if (sourceId) song.sourceId = sourceId;
    await refreshSongFromFile(song, st, { readTags: true });
    saver.schedule();
    const pub = toPublic(song);
    emit({ type: "upsert", songs: [pub] });
    return pub;
  }

  /** Remove the song from the library and delete its cached artwork. Does not touch the audio file. */
  async function removeSong(id) {
    const song = lib.songs[id];
    if (!song) return false;
    delete lib.songs[id];
    const thumb = songThumbPath(song);
    if (thumb && !Object.values(lib.songs).some((s) => s.thumbnailFile === song.thumbnailFile)) {
      await fs.unlink(thumb).catch((e) => {
        if (e.code !== "ENOENT") console.warn("[library] thumbnail cleanup failed:", e.message);
      });
    }
    saver.schedule();
    emit({ type: "remove", ids: [id] });
    return true;
  }

  /** What a cleanup would remove. Nothing is deleted here. */
  async function orphanReport() {
    const referenced = new Set(Object.values(lib.songs).map((s) => s.thumbnailFile).filter(Boolean));
    let orphanThumbs = [];
    try {
      orphanThumbs = (await fs.readdir(thumbsDir)).filter((f) => !referenced.has(f));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    let bytes = 0;
    for (const f of orphanThumbs) bytes += (await fs.stat(path.join(thumbsDir, f)).catch(() => ({ size: 0 }))).size;
    const missing = Object.values(lib.songs)
      .filter((s) => s.missing)
      .map((s) => ({ id: s.id, title: s.metadata ? s.metadata.title : s.fileName, path: s.path }));
    return { orphanThumbnails: orphanThumbs.length, orphanThumbnailBytes: bytes, missing };
  }

  async function removeOrphanThumbnails() {
    const referenced = new Set(Object.values(lib.songs).map((s) => s.thumbnailFile).filter(Boolean));
    let removed = 0;
    for (const f of await fs.readdir(thumbsDir).catch(() => [])) {
      if (referenced.has(f) || f.startsWith(".")) continue;
      await fs.unlink(path.join(thumbsDir, f)).then(() => removed++, (e) => console.warn("[library] could not remove", f, e.message));
    }
    return removed;
  }

  /** Forget library entries whose files are gone (only the ids the user confirmed). */
  async function forgetMissing(ids) {
    const gone = [];
    for (const id of ids) {
      const s = lib.songs[id];
      if (s && s.missing) {
        delete lib.songs[id];
        gone.push(id);
      }
    }
    if (gone.length) await saver.schedule();
    return gone;
  }

  function setSourceId(id, sourceId) {
    const s = lib.songs[id];
    if (!s || s.sourceId === sourceId) return;
    s.sourceId = sourceId;
    saver.schedule();
    emit({ type: "upsert", songs: [toPublic(s)] });
  }

  async function thumbnailFor(id) {
    const s = lib.songs[id];
    const p = s && songThumbPath(s);
    return p && (await exists(p)) ? p : null;
  }

  return {
    load,
    scan,
    snapshot,
    addFile,
    removeSong,
    setSourceId,
    orphanReport,
    removeOrphanThumbnails,
    forgetMissing,
    getSong,
    hasSong,
    pathToId,
    visibleSongs,
    thumbnailFor,
    get rootDir() {
      return lib.rootDir;
    },
    get thumbsDir() {
      return thumbsDir;
    },
    allSongsRaw: () => Object.values(lib.songs),
    flush: () => saver.flush(),
  };
}

module.exports = { createLibraryStore };
