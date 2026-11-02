// yt-dlp wrapper: one spawn helper, auth arguments, and error classification.
//
// Credentials: we only ever pass yt-dlp's own supported mechanisms
// (--cookies-from-browser or --cookies <file>). Cookie values never pass
// through this code, and arguments are redacted before anything is logged.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const BROWSERS = [
  { id: "firefox", label: "Firefox", dirs: [".mozilla/firefox"] },
  { id: "chrome", label: "Google Chrome", dirs: [".config/google-chrome"] },
  { id: "chromium", label: "Chromium", dirs: [".config/chromium"] },
  { id: "brave", label: "Brave", dirs: [".config/BraveSoftware/Brave-Browser"] },
  { id: "edge", label: "Microsoft Edge", dirs: [".config/microsoft-edge"] },
  { id: "vivaldi", label: "Vivaldi", dirs: [".config/vivaldi"] },
  { id: "opera", label: "Opera", dirs: [".config/opera"] },
];

function detectBrowsers() {
  const home = os.homedir();
  return BROWSERS.map((b) => ({ id: b.id, label: b.label, installed: b.dirs.some((d) => fs.existsSync(path.join(home, d))) }));
}

const credentialsDir = (userData) => path.join(userData, "credentials");
const cookieFilePath = (userData) => path.join(credentialsDir(userData), "youtube-cookies.txt");

class YtError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

/** yt-dlp arguments for the configured sign-in method. */
function authArgs(auth, userData) {
  if (!auth || auth.mode === "none") return [];
  if (auth.mode === "browser") {
    const browser = String(auth.browser || "").toLowerCase();
    if (!BROWSERS.some((b) => b.id === browser)) throw new YtError("AUTH_INVALID", `Unknown browser "${auth.browser}".`);
    const profile = String(auth.profile || "").trim();
    if (profile && /[:\0]/.test(profile)) throw new YtError("AUTH_INVALID", "The browser profile name can't contain ':'.");
    return ["--cookies-from-browser", profile ? `${browser}:${profile}` : browser];
  }
  if (auth.mode === "file") {
    const file = cookieFilePath(userData);
    if (!fs.existsSync(file)) throw new YtError("AUTH_FILE_MISSING", "No cookies file imported yet. Import one in Settings → YouTube.");
    return ["--cookies", file];
  }
  return [];
}

const SENSITIVE = new Set(["--cookies", "--cookies-from-browser", "--username", "--password", "--add-header"]);
function redactArgs(args) {
  return args.map((a, i) => (i > 0 && SENSITIVE.has(args[i - 1]) ? "<redacted>" : a));
}

/** Map yt-dlp stderr to a stable error code + a message a person can act on. */
function classifyError(stderr, { authMode = "none" } = {}) {
  const text = String(stderr || "");
  const signedIn = authMode !== "none";
  const lastError = (text.split("\n").filter((l) => /ERROR/.test(l)).pop() || "").replace(/^.*?ERROR:\s*/, "").trim();
  // yt-dlp couldn't solve YouTube's JavaScript challenge, so the signed-in (web)
  // clients expose no audio formats. Usually an outdated yt-dlp-ejs package.
  const solver = /Challenge solver lib script version ([\d.]+) is not supported.*?supported version: ([\d.]+)/i.exec(text);
  if (solver || /n challenge solving failed|Remote components challenge solver script .* were skipped|Ensure you have a supported JavaScript runtime/i.test(text)) {
    const detail = solver
      ? `Your yt-dlp-ejs challenge solver is version ${solver[1]}, but this yt-dlp needs ${solver[2]}.`
      : "yt-dlp couldn't solve YouTube's JavaScript challenge (no supported JS runtime or challenge solver found).";
    return new YtError(
      "YTDLP_JS_CHALLENGE",
      `${detail} Update your system so yt-dlp and yt-dlp-ejs match (on Arch: sudo pacman -Syu). Signed-in downloads need this; public videos fall back to the app's unsigned download.`,
      lastError,
    );
  }
  const rules = [
    [/cookies are no longer valid|cookies have (likely )?been rotated|cookies? (has|have) expired/i, "AUTH_EXPIRED", "Your YouTube sign-in has expired. Sign in to YouTube in your browser again (or export a fresh cookies file), then retry."],
    [/could not (find|copy|decrypt|open|read).{0,40}cookie|cookie database|database is locked|failed to decrypt|no (such )?(file|profile).{0,40}(cookie|profile)/i, "BROWSER_COOKIES_UNAVAILABLE", "Couldn't read your browser's YouTube cookies. Close the browser (it locks its cookie database), check the profile name, or use an exported cookies file instead."],
    [/sign in to confirm (your|you.?re) (age|not a bot)|confirm your age|age[- ]restricted|inappropriate for some users/i, signedIn ? "AUTH_EXPIRED" : "SIGN_IN_REQUIRED", signedIn ? "YouTube asked to sign in even though sign-in is set up. Your sign-in has probably expired — sign in again in your browser or re-export the cookies file." : "This video needs a signed-in YouTube account (age-restricted or bot check). Set up sign-in in Settings → YouTube."],
    [/this (page|playlist) requires (login|sign[- ]in)|login required|please sign in|you need to log in/i, signedIn ? "AUTH_EXPIRED" : "SIGN_IN_REQUIRED", signedIn ? "YouTube didn't accept your sign-in. It has probably expired — sign in again and retry." : "Sign in to YouTube in Settings → YouTube to see your own playlists."],
    [/private video|video is private/i, "PRIVATE_VIDEO", signedIn ? "This video is private and your account doesn't have access to it." : "This video is private. If it's yours, set up sign-in in Settings → YouTube."],
    [/playlist does not exist|the playlist.{0,20}(private|unavailable)/i, "PLAYLIST_UNAVAILABLE", "That playlist doesn't exist or isn't visible to your account."],
    [/HTTP Error 429|too many requests|rate.?limit/i, "RATE_LIMITED", "YouTube is rate-limiting requests. Wait a few minutes and try again."],
    [/video unavailable|has been removed|account.{0,40}terminated|not available in your country/i, "VIDEO_UNAVAILABLE", "This video isn't available."],
    [/requested format is not available|no video formats found/i, "FORMAT_UNAVAILABLE", "No downloadable audio format was found for this video."],
    [/unable to download webpage|getaddrinfo|network is unreachable|timed out|connection (reset|refused)/i, "NETWORK", "Couldn't reach YouTube. Check your internet connection."],
  ];
  for (const [re, code, message] of rules) if (re.test(text)) return new YtError(code, message, lastError);
  return new YtError("DOWNLOAD_FAILED", lastError || "yt-dlp failed for an unknown reason.", lastError);
}

/**
 * Run yt-dlp. Resolves with { stdout } on success, rejects with a classified YtError.
 * `onLine(line, stream)` receives every output line (stdout and stderr).
 */
function runYtDlp(args, { onLine, signal, authMode = "none", bin = process.env.B1T_YTDLP || "yt-dlp" } = {}) {
  return new Promise((resolve, reject) => {
    let proc;
    try {
      // Own process group so cancelling also stops yt-dlp's ffmpeg child.
      proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" });
    } catch (err) {
      return reject(new YtError("YTDLP_MISSING", `Couldn't start yt-dlp: ${err.message}`));
    }
    let stdout = "";
    let stderr = "";
    const feed = (stream) => {
      let buf = "";
      return (chunk) => {
        const text = chunk.toString();
        if (stream === "stdout") stdout += text;
        else {
          stderr += text;
          if (stderr.length > 50000) stderr = stderr.slice(-50000);
        }
        buf += text;
        const lines = buf.split(/\r?\n|\r/);
        buf = lines.pop();
        if (onLine) for (const l of lines) if (l) onLine(l, stream);
      };
    };
    proc.stdout.on("data", feed("stdout"));
    proc.stderr.on("data", feed("stderr"));
    const onAbort = () => {
      try {
        if (process.platform !== "win32" && proc.pid) process.kill(-proc.pid, "SIGTERM");
        else proc.kill("SIGTERM");
      } catch {
        proc.kill("SIGTERM");
      }
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
    proc.on("error", (err) => {
      reject(err.code === "ENOENT" ? new YtError("YTDLP_MISSING", "yt-dlp is not installed or not on your PATH.") : new YtError("YTDLP_FAILED", err.message));
    });
    proc.on("close", (code, sig) => {
      if (signal) signal.removeEventListener("abort", onAbort);
      if (signal?.aborted || sig) return reject(new YtError("CANCELLED", "Cancelled."));
      if (code !== 0) {
        const err = classifyError(stderr, { authMode });
        console.warn(`[yt-dlp] exit ${code} (${err.code}) for: yt-dlp ${redactArgs(args).join(" ")}`);
        return reject(err);
      }
      resolve({ stdout });
    });
  });
}

let jsDiagnosis = null;
/**
 * yt-dlp only explains JS-challenge problems (e.g. an outdated yt-dlp-ejs) in
 * verbose output. Once per session, repeat the failing request verbosely
 * (simulate only, same sign-in args, no cache) and classify it. The verbose
 * output is only parsed here, never logged. Resolves to a
 * YtError("YTDLP_JS_CHALLENGE") or null.
 */
function diagnoseJsChallenge(videoId, extraArgs = []) {
  if (!jsDiagnosis) {
    jsDiagnosis = new Promise((resolve) => {
      let stderr = "";
      let proc;
      try {
        proc = spawn(process.env.B1T_YTDLP || "yt-dlp", [...extraArgs, "-v", "--no-cache-dir", "--simulate", "--no-playlist", "-f", "bestaudio/best", "--print", "id", `https://www.youtube.com/watch?v=${videoId}`], { stdio: ["ignore", "ignore", "pipe"] });
      } catch {
        return resolve(null);
      }
      proc.stderr.on("data", (b) => {
        stderr += b.toString();
        if (stderr.length > 200000) stderr = stderr.slice(-200000);
      });
      const timer = setTimeout(() => proc.kill("SIGTERM"), 60000);
      proc.on("error", () => resolve(null));
      proc.on("close", () => {
        clearTimeout(timer);
        const err = classifyError(stderr, { authMode: "file" });
        resolve(err.code === "YTDLP_JS_CHALLENGE" ? err : null);
      });
    });
  }
  return jsDiagnosis;
}

module.exports = { diagnoseJsChallenge, BROWSERS, detectBrowsers, authArgs, redactArgs, classifyError, runYtDlp, YtError, cookieFilePath, credentialsDir };
