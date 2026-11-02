// Download queue: YouTube video → MP3 in the music folder → library song.
// - concurrency 2, cancel per item or all
// - one yt-dlp process per video; final path read from --print after_move:filepath
// - filenames "<title> [<videoId>].mp3" so different videos never collide;
//   an unrelated file already at that path gets a " (2)" suffix
// - already-downloaded videos (matched by YouTube id) are skipped, never re-downloaded
// - never touches Likes
const fs = require("fs").promises;
const path = require("path");
const { runYtDlp, YtError } = require("./ytdlp.cjs");

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const CONCURRENCY = 2;

function sanitizeTitle(title) {
  return (
    String(title || "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/, "")
      .slice(0, 150) || "Untitled"
  );
}

async function availablePath(dir, base, ext) {
  for (let n = 1; n < 1000; n++) {
    const candidate = path.join(dir, `${base}${n === 1 ? "" : ` (${n})`}.${ext}`);
    try {
      await fs.access(candidate);
    } catch {
      return candidate;
    }
  }
  throw new YtError("DOWNLOAD_FAILED", "Couldn't find a free file name.");
}

function createDownloadManager({ library, user, youtube, emit }) {
  /** videoId -> item */
  const items = new Map();
  const waiters = new Map(); // videoId -> [resolve]
  let active = 0;
  const lastEmit = new Map();

  const publicItem = (it) => ({ videoId: it.videoId, title: it.title, status: it.status, percent: it.percent, error: it.error, songId: it.songId, note: it.note ?? null, playlistId: it.target?.id ?? null, addedAt: it.addedAt });
  const update = (it, patch, { force = true } = {}) => {
    Object.assign(it, patch);
    const now = Date.now();
    if (!force && now - (lastEmit.get(it.videoId) || 0) < 250) return;
    lastEmit.set(it.videoId, now);
    emit(publicItem(it));
    if (["done", "error", "cancelled", "skipped"].includes(it.status)) {
      for (const w of waiters.get(it.videoId) || []) w(publicItem(it));
      waiters.delete(it.videoId);
    }
  };

  const norm = (t) => String(t || "").trim().toLowerCase().replace(/\s+/g, " ");
  /**
   * The library song for this video: exact match by YouTube id, or — for files
   * downloaded before ids were recorded — the single id-less song with the same
   * title (then its id is recorded). Ambiguous title matches are not used.
   */
  function existingSong(videoId, title) {
    const songs = library.visibleSongs();
    const exact = songs.find((s) => s.sourceId === videoId);
    if (exact) return { song: exact, how: "id" };
    const t = norm(title);
    const legacy = songs.filter((s) => !s.sourceId && norm(s.metadata && s.metadata.title) === t);
    if (t && legacy.length === 1) {
      library.setSourceId(legacy[0].id, videoId);
      return { song: legacy[0], how: "title" };
    }
    return null;
  }

  function addToTarget(it, songId) {
    if (!it.target) return;
    try {
      user.addSongs(it.target.id, [songId]);
    } catch (err) {
      console.warn("[downloads] couldn't add to playlist:", err.message);
    }
  }

  async function run(it) {
    const root = library.rootDir;
    if (!root) throw new YtError("NO_ROOT_DIR", "Pick a music folder in Settings before downloading.");
    const base = `${sanitizeTitle(it.title)} [${it.videoId}]`;
    // Same video already on disk but not in the library (e.g. added while the app was closed): just add it.
    const sameFile = path.join(root, `${base}.mp3`);
    try {
      await fs.access(sameFile);
      const song = await library.addFile(sameFile, { sourceId: it.videoId });
      addToTarget(it, song.id);
      return song;
    } catch {
      /* not on disk → download */
    }
    const target = await availablePath(root, base, "mp3");
    const template = target.replace(/\.mp3$/, ".%(ext)s");
    const mode = youtube.authMode();
    const args = [
      ...youtube.authArgs(),
      // The android client avoids some throttling but can't use cookies.
      ...(mode === "none" ? ["--extractor-args", "youtube:player_client=android"] : []),
      "--force-ipv4",
      "--no-warnings",
      "--no-playlist",
      "-x", "--audio-format", "mp3", "--audio-quality", "0",
      "--embed-thumbnail", "--add-metadata",
      "--newline", "--progress",
      "--print", "after_move:filepath",
      "-o", template,
      `https://www.youtube.com/watch?v=${it.videoId}`,
    ];
    let finalPath = null;
    // Remember what was there so a failed/cancelled run only removes its own partial files.
    const before = new Set(await fs.readdir(root).catch(() => []));
    const stem = path.basename(template).replace(/\.%\(ext\)s$/, "");
    const cleanupPartials = async () => {
      for (const f of await fs.readdir(root).catch(() => [])) {
        if (!before.has(f) && f.startsWith(stem + ".")) await fs.unlink(path.join(root, f)).catch(() => {});
      }
    };
    try {
      await runYtDlpWithCleanup();
    } catch (err) {
      await cleanupPartials();
      throw err;
    }
    async function runYtDlpWithCleanup() {
    await runYtDlp(args, {
      signal: it.abort.signal,
      authMode: mode,
      onLine: (line, stream) => {
        const m = /\[download\]\s+(\d+(?:\.\d+)?)%/.exec(line);
        if (m) update(it, { percent: Number(m[1]) }, { force: false });
        else if (stream === "stdout" && path.isAbsolute(line.trim()) && /\.mp3$/i.test(line.trim())) finalPath = line.trim();
      },
    });
    }
    const file = finalPath || target;
    await fs.access(file).catch(() => {
      throw new YtError("DOWNLOAD_FAILED", "yt-dlp finished but the MP3 file wasn't found.");
    });
    const song = await library.addFile(file, { sourceId: it.videoId });
    user.addRecentlyDownloaded(song.id);
    addToTarget(it, song.id);
    return song;
  }

  function pump() {
    while (active < CONCURRENCY) {
      const next = [...items.values()].find((i) => i.status === "queued")
      if (!next) return;
      active++;
      update(next, { status: "downloading", percent: 0 });
      run(next)
        .then((song) => update(next, { status: "done", percent: 100, songId: song.id }))
        .catch((err) => update(next, err.code === "CANCELLED" ? { status: "cancelled" } : { status: "error", error: { code: err.code || "DOWNLOAD_FAILED", message: err.message } }))
        .finally(() => {
          active--;
          pump();
        });
    }
  }

  /** Queue videos. `target` = local playlist to add each song to (including already-downloaded ones). */
  function enqueue(videos, { target = null } = {}) {
    const out = [];
    for (const v of videos) {
      if (!v || !VIDEO_ID_RE.test(String(v.videoId))) continue;
      const prev = items.get(v.videoId);
      if (prev && (prev.status === "queued" || prev.status === "downloading")) {
        if (target && !prev.target) prev.target = target;
        out.push(publicItem(prev));
        continue;
      }
      const it = { videoId: v.videoId, title: v.title || v.videoId, status: "queued", percent: 0, error: null, songId: null, target, addedAt: Date.now(), abort: new AbortController() };
      items.set(v.videoId, it);
      const existing = existingSong(v.videoId, v.title);
      if (existing) {
        addToTarget(it, existing.song.id);
        update(it, { status: "skipped", songId: existing.song.id, percent: 100, note: existing.how === "title" ? "matched by title" : "already in library" });
      } else update(it, {});
      out.push(publicItem(it));
    }
    pump();
    return out;
  }

  function waitFor(videoId) {
    const it = items.get(videoId);
    if (it && ["done", "error", "cancelled", "skipped"].includes(it.status)) return Promise.resolve(publicItem(it));
    return new Promise((resolve) => {
      const list = waiters.get(videoId) || [];
      list.push(resolve);
      waiters.set(videoId, list);
    });
  }

  function cancel(videoId) {
    const it = items.get(videoId);
    if (!it) return false;
    if (it.status === "queued") update(it, { status: "cancelled" });
    else if (it.status === "downloading") it.abort.abort();
    return true;
  }

  function cancelAll() {
    for (const it of items.values()) if (it.status === "queued" || it.status === "downloading") cancel(it.videoId);
  }

  function clearFinished() {
    for (const [id, it] of items) if (!["queued", "downloading"].includes(it.status)) items.delete(id);
    return list();
  }

  const list = () => [...items.values()].map(publicItem);

  return { enqueue, waitFor, cancel, cancelAll, clearFinished, list };
}

module.exports = { createDownloadManager, sanitizeTitle };
