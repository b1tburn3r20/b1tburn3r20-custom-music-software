// Download queue: YouTube video → MP3 in the music folder → library song.
// - Downloads run two at a time, but results are COMMITTED STRICTLY IN QUEUE
//   ORDER (library, Recently Downloaded, target playlist). A short song that
//   finishes before a longer one queued earlier waits ("finishing…"), so a
//   playlist always ends up in its original order.
// - Already-owned videos are skipped: exact YouTube id, or (for pre-overhaul
//   downloads) a strict title + artist + duration match. A title alone never matches.
// - One yt-dlp process per video; final path read from --print after_move:filepath.
// - Filenames "<title> [<videoId>].mp3" never collide; an unrelated file at that
//   path gets a " (2)" suffix. Cancel kills the whole process group and removes
//   that run's partial files. Never touches Likes.
const fs = require("fs").promises;
const path = require("path");
const { runYtDlp, YtError } = require("./ytdlp.cjs");
const { findOwnedSong } = require("../../shared/songMatch.mjs");

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const CONCURRENCY = 2;
const FINAL = new Set(["done", "error", "cancelled", "skipped"]);

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
  /** videoId -> item. Items carry `seq` (queue order) and internal `phase`. */
  const items = new Map();
  const waiters = new Map();
  let seq = 0;
  let active = 0;
  let committing = Promise.resolve();
  const lastEmit = new Map();

  const publicItem = (it) => ({
    videoId: it.videoId,
    title: it.title,
    status: it.status,
    percent: it.percent,
    error: it.error,
    songId: it.songId,
    note: it.note ?? null,
    playlistId: it.target?.id ?? null,
    addedAt: it.addedAt,
  });

  function update(it, patch, { force = true } = {}) {
    Object.assign(it, patch);
    const now = Date.now();
    if (!force && now - (lastEmit.get(it.videoId) || 0) < 250) return;
    lastEmit.set(it.videoId, now);
    emit(publicItem(it));
    if (FINAL.has(it.status)) {
      for (const w of waiters.get(it.videoId) || []) w(publicItem(it));
      waiters.delete(it.videoId);
    }
  }

  function ownedSong(video) {
    return findOwnedSong(library.visibleSongs(), { id: video.videoId, title: video.title, channel: video.channel || "", duration: video.duration || 0 });
  }

  function addToTarget(it, songId) {
    if (!it.target) return;
    try {
      user.addSongs(it.target.id, [songId]);
    } catch (err) {
      console.warn("[downloads] couldn't add to playlist:", err.message);
    }
  }

  /** Download the file only. Library registration happens in commit order. */
  async function download(it) {
    const root = library.rootDir;
    if (!root) throw new YtError("NO_ROOT_DIR", "Pick a music folder in Settings before downloading.");
    const base = `${sanitizeTitle(it.title)} [${it.videoId}]`;
    // Same video already on disk but not in the library (e.g. added while the app was closed): reuse it.
    const sameFile = path.join(root, `${base}.mp3`);
    try {
      await fs.access(sameFile);
      return sameFile;
    } catch {
      /* not on disk → download */
    }
    const target = await availablePath(root, base, "mp3");
    const template = target.replace(/\.mp3$/, ".%(ext)s");
    const stem = path.basename(template).replace(/\.%\(ext\)s$/, "");
    const before = new Set(await fs.readdir(root).catch(() => []));
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
    try {
      await runYtDlp(args, {
        signal: it.abort.signal,
        authMode: mode,
        onLine: (line, stream) => {
          const m = /\[download\]\s+(\d+(?:\.\d+)?)%/.exec(line);
          if (m) update(it, { percent: Math.min(99, Number(m[1])) }, { force: false });
          else if (stream === "stdout" && path.isAbsolute(line.trim()) && /\.mp3$/i.test(line.trim())) finalPath = line.trim();
        },
      });
    } catch (err) {
      for (const f of await fs.readdir(root).catch(() => [])) {
        if (!before.has(f) && f.startsWith(stem + ".")) await fs.unlink(path.join(root, f)).catch(() => {});
      }
      throw err;
    }
    const file = finalPath || target;
    await fs.access(file).catch(() => {
      throw new YtError("DOWNLOAD_FAILED", "yt-dlp finished but the MP3 file wasn't found.");
    });
    return file;
  }

  /** Commit finished items strictly in queue order; stop at the first one still in progress. */
  function commitInOrder() {
    committing = committing
      .then(async () => {
        const ordered = [...items.values()].filter((i) => !i.committed).sort((a, b) => a.seq - b.seq);
        for (const it of ordered) {
          if (it.phase === "downloaded") {
            try {
              const song = await library.addFile(it.file, { sourceId: it.videoId });
              user.addRecentlyDownloaded(song.id);
              addToTarget(it, song.id);
              it.committed = true;
              update(it, { status: "done", percent: 100, songId: song.id, note: null });
            } catch (err) {
              it.committed = true;
              update(it, { status: "error", error: { code: "DOWNLOAD_FAILED", message: `Downloaded, but couldn't add it to the library: ${err.message}` } });
            }
          } else if (it.phase === "owned") {
            addToTarget(it, it.songId);
            it.committed = true;
            update(it, { status: "skipped", percent: 100 });
          } else if (it.phase === "failed") {
            it.committed = true; // already reported; just don't block later items
          } else break; // queued or downloading: later items must wait
        }
      })
      .catch((err) => console.error("[downloads] commit failed:", err));
    return committing;
  }

  function pump() {
    while (active < CONCURRENCY) {
      const next = [...items.values()].filter((i) => i.phase === "queued").sort((a, b) => a.seq - b.seq)[0];
      if (!next) return;
      active++;
      next.phase = "downloading";
      update(next, { status: "downloading", percent: 0 });
      download(next)
        .then((file) => {
          next.phase = "downloaded";
          next.file = file;
          update(next, { percent: 100, note: "finishing…" });
        })
        .catch((err) => {
          next.phase = "failed";
          update(next, err.code === "CANCELLED" ? { status: "cancelled" } : { status: "error", error: { code: err.code || "DOWNLOAD_FAILED", message: err.message } });
        })
        .finally(() => {
          active--;
          commitInOrder();
          pump();
        });
    }
  }

  /**
   * Queue videos in the given order. `target` = local playlist to add each song to
   * (including already-owned ones), in that same order.
   * Each video: { videoId, title, channel?, duration? } — channel/duration enable safe matching.
   */
  function enqueue(videos, { target = null } = {}) {
    const out = [];
    for (const v of videos) {
      if (!v || !VIDEO_ID_RE.test(String(v.videoId))) continue;
      const prev = items.get(v.videoId);
      if (prev && !prev.committed) {
        if (target && !prev.target) prev.target = target;
        out.push(publicItem(prev));
        continue;
      }
      const it = { videoId: v.videoId, title: v.title || v.videoId, seq: ++seq, phase: "queued", status: "queued", percent: 0, error: null, songId: null, note: null, target, addedAt: Date.now(), abort: new AbortController(), committed: false };
      items.set(v.videoId, it);
      const owned = ownedSong(v);
      if (owned) {
        it.phase = "owned";
        update(it, { songId: owned.song.id, note: owned.exact ? "already in library" : "matched title, artist and length" });
        // Record the id only after a strict match, so it's exact from now on.
        if (!owned.exact) library.setSourceId(owned.song.id, v.videoId);
      } else update(it, {});
      out.push(publicItem(it));
    }
    commitInOrder();
    pump();
    return out;
  }

  function waitFor(videoId) {
    const it = items.get(videoId);
    if (it && FINAL.has(it.status)) return Promise.resolve(publicItem(it));
    return new Promise((resolve) => {
      const list = waiters.get(videoId) || [];
      list.push(resolve);
      waiters.set(videoId, list);
    });
  }

  function cancel(videoId) {
    const it = items.get(videoId);
    if (!it || it.committed) return false;
    if (it.phase === "queued") {
      it.phase = "failed";
      update(it, { status: "cancelled" });
      commitInOrder();
    } else if (it.phase === "downloading") it.abort.abort();
    return true;
  }

  function cancelAll() {
    for (const it of items.values()) if (it.phase === "queued" || it.phase === "downloading") cancel(it.videoId);
  }

  function clearFinished() {
    for (const [id, it] of items) if (it.committed) items.delete(id);
    return list();
  }

  const list = () => [...items.values()].sort((a, b) => a.seq - b.seq).map(publicItem);

  return { enqueue, waitFor, cancel, cancelAll, clearFinished, list };
}

module.exports = { createDownloadManager, sanitizeTitle };
