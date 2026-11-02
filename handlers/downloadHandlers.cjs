// YouTube → MP3 via yt-dlp.
// - One yt-dlp process per video (metadata used to be fetched by a separate
//   process and then thrown away).
// - Filenames are "<title> [<videoId>].mp3", so two different videos with the
//   same title can never overwrite each other.
// - The downloaded file is registered in the library (stable id + sourceId) and
//   added to Recently Downloaded. It never touches Likes.
const { ipcMain } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs").promises;

const active = new Map(); // videoId -> ChildProcess

function sanitizeTitle(title) {
  return String(title || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150) || "Untitled";
}

async function uniquePath(dir, base, ext) {
  let candidate = path.join(dir, `${base}.${ext}`);
  for (let n = 2; ; n++) {
    try {
      await fs.access(candidate);
      candidate = path.join(dir, `${base} (${n}).${ext}`);
    } catch {
      return candidate;
    }
  }
}

function registerDownloadHandlers({ library, user }) {
  ipcMain.handle("download-youtube", async (event, { videoId, title }) => {
    try {
      if (!/^[A-Za-z0-9_-]{11}$/.test(String(videoId))) throw Object.assign(new Error("Invalid video id"), { code: "BAD_INPUT" });
      const saveDir = library.rootDir;
      if (!saveDir) throw Object.assign(new Error("Pick a music folder in Settings before downloading."), { code: "NO_ROOT_DIR" });

      // Already downloaded? Match by YouTube id, never by title.
      const existing = library.visibleSongs().find((s) => s.sourceId === videoId);
      if (existing) {
        return { ok: true, data: { song: library.snapshot().songs.find((s) => s.id === existing.id), alreadyHad: true } };
      }

      const base = `${sanitizeTitle(title)} [${videoId}]`;
      const target = await uniquePath(saveDir, base, "mp3");
      const outTemplate = target.replace(/\.mp3$/, ".%(ext)s");
      const finalPath = await runYtDlp(event, videoId, outTemplate);
      const song = await library.addFile(finalPath || target, { sourceId: videoId });
      user.addRecentlyDownloaded(song.id);
      event.sender.send("download-complete", { videoId, song, success: true });
      return { ok: true, data: { song, alreadyHad: false } };
    } catch (err) {
      return { ok: false, error: { code: err.code || "DOWNLOAD_FAILED", message: err.message } };
    }
  });

  ipcMain.handle("cancel-download", () => {
    for (const proc of active.values()) {
      try {
        proc.kill("SIGTERM");
      } catch (err) {
        console.error("[download] kill failed:", err.message);
      }
    }
    active.clear();
    return { ok: true, data: { cancelled: true } };
  });
}

function runYtDlp(event, videoId, outTemplate) {
  return new Promise((resolve, reject) => {
    const args = [
      "--extractor-args", "youtube:player_client=android",
      "--force-ipv4",
      "--no-warnings",
      "--no-playlist",
      "-x", "--audio-format", "mp3", "--audio-quality", "0",
      "--embed-thumbnail", "--add-metadata",
      "--newline", "--progress", // --print implies --quiet; keep progress lines
      "--print", "after_move:filepath",
      "-o", outTemplate,
      `https://www.youtube.com/watch?v=${videoId}`,
    ];
    const proc = spawn("yt-dlp", args);
    active.set(videoId, proc);
    let stderr = "";
    let finalPath = null;
    proc.stdout.on("data", (buf) => {
      for (const line of buf.toString().split("\n")) {
        const pct = /\[download\]\s+(\d+(?:\.\d+)?)%/.exec(line);
        if (pct) event.sender.send("download-progress", { videoId, percent: Number(pct[1]) });
        else if (line.trim().startsWith("/")) finalPath = line.trim();
      }
    });
    proc.stderr.on("data", (buf) => {
      const text = buf.toString();
      const pct = /\[download\]\s+(\d+(?:\.\d+)?)%/.exec(text);
      if (pct) event.sender.send("download-progress", { videoId, percent: Number(pct[1]) });
      stderr += text;
      if (stderr.length > 20000) stderr = stderr.slice(-20000);
    });
    proc.on("error", (err) => {
      active.delete(videoId);
      reject(Object.assign(new Error(err.code === "ENOENT" ? "yt-dlp is not installed or not on PATH." : err.message), { code: "YTDLP_MISSING" }));
    });
    proc.on("close", (code, signal) => {
      active.delete(videoId);
      if (signal || code === null) return reject(Object.assign(new Error("Download cancelled"), { code: "CANCELLED" }));
      if (code !== 0) {
        const lastErr = stderr.split("\n").filter((l) => /ERROR/.test(l)).pop() || `yt-dlp exited with code ${code}`;
        return reject(Object.assign(new Error(lastErr.replace(/^ERROR:\s*/, "")), { code: "DOWNLOAD_FAILED" }));
      }
      resolve(finalPath);
    });
  });
}

module.exports = { registerDownloadHandlers, sanitizeTitle };
