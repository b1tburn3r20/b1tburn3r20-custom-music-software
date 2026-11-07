// What to try after a download fails. YouTube often refuses one way of asking but not another,
// and a video that fails signed in frequently works without sign-in, so a single failure
// shouldn't lose the song. Also writes a log, because the error list is gone after a restart.
const fs = require("fs").promises;
const path = require("path");
const { redact } = require("../lib/errorLog.cjs");

// Asking differently can't help with these.
const FINAL_CODES = new Set(["CANCELLED", "NO_ROOT_DIR", "FOLDER_NOT_WRITABLE", "YTDLP_MISSING", "YTDLP_CANT_RUN", "RATE_LIMITED", "VIDEO_UNAVAILABLE", "PRIVATE_VIDEO"]);
const CONVERSION_FAILED = /postprocessing|thumbnail|embed/i;
const MAX_LOG_BYTES = 512 * 1024;

/** signed: the user's sign-in. android and plain: without sign-in, using different YouTube clients. */
const firstAttempt = (authMode) => ({ mode: authMode === "none" ? "android" : "signed", noThumbnail: false });

/** The next way to try, or null if there's no point. */
function nextAttempt(attempt, err) {
  if (FINAL_CODES.has(err.code)) return null;
  // A song without its cover art beats no song.
  if (!attempt.noThumbnail && CONVERSION_FAILED.test(`${err.detail || ""} ${err.message || ""}`)) return { ...attempt, noThumbnail: true };
  if (attempt.mode === "signed") return { ...attempt, mode: "android" };
  if (attempt.mode === "android") return { ...attempt, mode: "plain" };
  return null;
}

/** Appends to a small log, keeping one older file. It holds yt-dlp's messages, never cookie values. */
function createDownloadLog(file) {
  let writing = Promise.resolve();
  const write = async (text) => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const size = await fs.stat(file).then((s) => s.size, () => 0);
    if (size > MAX_LOG_BYTES) await fs.rename(file, `${file}.old`).catch(() => {});
    await fs.appendFile(file, text, "utf-8");
  };
  return {
    file,
    record({ video, title, attempt, outcome, err }) {
      const lines = [`${new Date().toISOString()} ${outcome} ${video} "${title}" tried=${attempt.mode}${attempt.noThumbnail ? "+no-thumbnail" : ""}${err ? ` code=${err.code} exit=${err.exitCode ?? "?"}` : ""}`];
      if (err) lines.push(`  ${err.message}${err.detail && err.detail !== err.message ? ` (${err.detail})` : ""}`, ...(err.stderrTail || []).map((l) => `  | ${l}`));
      writing = writing.then(() => write(`${redact(lines.join("\n"))}\n`)).catch((e) => console.warn("[downloads] couldn't write the log:", e.message));
      return writing;
    },
  };
}

module.exports = { firstAttempt, nextAttempt, createDownloadLog };
