// yt-dlp wrapper: one spawn helper, auth arguments, and error classification.
//
// Credentials: we only ever pass yt-dlp's own supported mechanisms
// (--cookies-from-browser or --cookies <file>). Cookie values never pass
// through this code, and arguments are redacted before anything is logged.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { explainExit, killProcessTree, resolveTool, ytDlpBaseArgs } = require("../lib/tools.cjs");

// Each browser's profile folder, relative to: linux = home, darwin = ~/Library/Application Support,
// win32 = %LOCALAPPDATA% unless `winRoaming` says %APPDATA%.
const BROWSERS = [
  { id: "firefox", label: "Firefox", linux: ".mozilla/firefox", darwin: "Firefox", win32: "Mozilla/Firefox", winRoaming: true },
  { id: "chrome", label: "Google Chrome", linux: ".config/google-chrome", darwin: "Google/Chrome", win32: "Google/Chrome/User Data" },
  { id: "chromium", label: "Chromium", linux: ".config/chromium", darwin: "Chromium", win32: "Chromium/User Data" },
  { id: "brave", label: "Brave", linux: ".config/BraveSoftware/Brave-Browser", darwin: "BraveSoftware/Brave-Browser", win32: "BraveSoftware/Brave-Browser/User Data" },
  { id: "edge", label: "Microsoft Edge", linux: ".config/microsoft-edge", darwin: "Microsoft Edge", win32: "Microsoft/Edge/User Data" },
  { id: "vivaldi", label: "Vivaldi", linux: ".config/vivaldi", darwin: "Vivaldi", win32: "Vivaldi/User Data" },
  { id: "opera", label: "Opera", linux: ".config/opera", darwin: "com.operasoftware.Opera", win32: "Opera Software/Opera Stable", winRoaming: true },
];

function browserProfileDir(browser, { platform = process.platform, home = os.homedir(), env = process.env } = {}) {
  if (platform === "win32") {
    const base = browser.winRoaming ? env.APPDATA || path.join(home, "AppData", "Roaming") : env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    return path.join(base, browser.win32);
  }
  if (platform === "darwin") return path.join(home, "Library", "Application Support", browser.darwin);
  return path.join(home, browser.linux);
}

function detectBrowsers(options) {
  return BROWSERS.map((b) => ({ id: b.id, label: b.label, installed: fs.existsSync(browserProfileDir(b, options)) }));
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

/**
 * Only the cookies YouTube sign-in needs. An "export all" file can hold every site's
 * sessions, like email and banking, and those have no business being copied here.
 */
function youtubeCookiesOnly(text) {
  const kept = String(text)
    .split(/\r?\n/)
    .filter((line) => {
      const fields = line.split("\t");
      if (fields.length < 7) return false;
      const domain = fields[0].replace(/^#HttpOnly_/, "").replace(/^\./, "").toLowerCase();
      if (fields[0].startsWith("#") && !fields[0].startsWith("#HttpOnly_")) return false;
      return ["youtube.com", "google.com"].some((d) => domain === d || domain.endsWith(`.${d}`));
    });
  return `# Netscape HTTP Cookie File\n${kept.join("\n")}\n`; // yt-dlp requires this first line
}

/** Does this file hold a YouTube sign-in at all? Reads cookie names only, never their values. */
function hasSignInCookies(text) {
  return String(text)
    .split(/\r?\n/)
    .some((line) => {
      const fields = line.split("\t");
      if (fields.length < 7) return false;
      const domain = fields[0].replace(/^#HttpOnly_/, "").replace(/^\./, "").toLowerCase();
      return (domain === "youtube.com" || domain.endsWith(".youtube.com")) && /^(__Secure-[13]P)?(SAPISID|APISID)$|^SAPISID$|^LOGIN_INFO$/.test(fields[5]);
    });
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
function classifyError(stderr, { authMode = "none", exitCode } = {}) {
  const text = String(stderr || "");
  const signedIn = authMode !== "none";
  const lastError = (text.split("\n").filter((l) => /ERROR/.test(l)).pop() || "").replace(/^.*?ERROR:\s*/, "").trim();
  // yt-dlp couldn't solve YouTube's JavaScript challenge, so the signed-in (web)
  // clients expose no audio formats. The standalone binary bundles a matching solver,
  // so updating that one file fixes this without any system upgrade.
  const solver = /Challenge solver lib script version ([\d.]+) is not supported.*?supported version: ([\d.]+)/i.exec(text);
  if (solver || /n challenge solving failed|Remote components challenge solver script .* were skipped|Ensure you have a supported JavaScript runtime/i.test(text)) {
    const detail = solver
      ? `Your yt-dlp-ejs challenge solver is version ${solver[1]}, but this yt-dlp needs ${solver[2]}.`
      : "yt-dlp couldn't solve YouTube's JavaScript challenge (no supported JS runtime or challenge solver found).";
    return new YtError(
      "YTDLP_JS_CHALLENGE",
      `${detail} Update yt-dlp in Settings → YouTube. Signed-in downloads need this; public videos fall back to the app's unsigned download.`,
      lastError,
    );
  }
  // The bundled Python never started, so nothing below would be a fair description.
  if (/Failed to (load Python DLL|extract|execute script)|PYI-\d+|MSVCR100|VCRUNTIME\d+|python\d+\.dll/i.test(text)) {
    return new YtError("YTDLP_CANT_RUN", `yt-dlp couldn't start on this computer. Run Windows Update, install the latest Microsoft Visual C++ Redistributable, and check that antivirus software isn't blocking it. (${(lastError || text.trim().split(/\r?\n/).pop()).slice(0, 200)})`, lastError);
  }
  const rules = [
    // Made-up cookies and a signed-out file both get exactly this, so it can't say which.
    [/HTTP Error 401|401: Unauthorized/i, signedIn ? "AUTH_EXPIRED" : "SIGN_IN_REQUIRED", signedIn ? "YouTube didn't accept your sign-in." : "YouTube needs you to sign in for this."],
    [/cookies are no longer valid|cookies have (likely )?been rotated|cookies? (has|have) expired/i, "AUTH_EXPIRED", "YouTube no longer accepts your cookies. Upload a fresh cookies.txt, then retry."],
    [/could not (find|copy|decrypt|open|read).{0,40}cookie|cookie database|database is locked|failed to decrypt|no (such )?(file|profile).{0,40}(cookie|profile)/i, "BROWSER_COOKIES_UNAVAILABLE", "Couldn't read your browser's YouTube cookies. Close the browser (it locks its cookie database), check the profile name, or use an exported cookies file instead."],
    [/sign in to confirm (your|you.?re) (age|not a bot)|confirm your age|age[- ]restricted|inappropriate for some users/i, signedIn ? "AUTH_EXPIRED" : "SIGN_IN_REQUIRED", signedIn ? "YouTube asked to sign in even though sign-in is set up. Your sign-in has probably expired — sign in again in your browser or re-export the cookies file." : "This video needs a signed-in YouTube account (age-restricted or bot check). Set up sign-in in Settings → YouTube."],
    [/this (page|playlist) requires (login|sign[- ]in)|login required|please sign in|you need to log in/i, signedIn ? "AUTH_EXPIRED" : "SIGN_IN_REQUIRED", signedIn ? "YouTube didn't accept your sign-in. It has probably expired — sign in again and retry." : "Sign in to YouTube in Settings → YouTube to see your own playlists."],
    [/private video|video is private/i, "PRIVATE_VIDEO", signedIn ? "This video is private and your account doesn't have access to it." : "This video is private. If it's yours, set up sign-in in Settings → YouTube."],
    [/playlist type is unviewable/i, "PLAYLIST_UNAVAILABLE", "YouTube won't open this kind of playlist from a link on its own. Copy the link from the page where it's playing."],
    [/playlist does not exist|the playlist.{0,20}(private|unavailable)/i, "PLAYLIST_UNAVAILABLE", "That playlist doesn't exist or isn't visible to your account."],
    [/HTTP Error 429|too many requests|rate.?limit/i, "RATE_LIMITED", "YouTube is rate-limiting requests. Wait a few minutes and try again."],
    [/permission denied|errno 13|access is denied|read-only file system/i, "FOLDER_NOT_WRITABLE", "Couldn't save to your music folder. Your system may be blocking it (on Windows, check Controlled Folder Access). Choose a different folder in Settings → Library."],
    [/video unavailable|has been removed|account.{0,40}terminated|not available in your country/i, "VIDEO_UNAVAILABLE", "This video isn't available."],
    [/requested format is not available|no video formats found/i, "FORMAT_UNAVAILABLE", "No downloadable audio format was found for this video."],
    [/HTTP Error 403|403: Forbidden/i, "YOUTUBE_REFUSED", "YouTube refused this download. Trying it again later often works."],
    [/unable to download webpage|getaddrinfo|network is unreachable|timed out|connection (reset|refused)/i, "NETWORK", "Couldn't reach YouTube. Check your internet connection."],
  ];
  for (const [re, code, message] of rules) if (re.test(text)) return new YtError(code, message, lastError);
  if (lastError) return new YtError("DOWNLOAD_FAILED", lastError, lastError);
  // No ERROR line, so whatever it said last and how it ended is all there is to go on.
  const lastLine = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop();
  const ended = exitCode == null ? "failed for an unknown reason" : explainExit(exitCode);
  return new YtError("DOWNLOAD_FAILED", `yt-dlp ${ended}${lastLine ? `: ${lastLine.slice(0, 300)}` : "."}`, lastError);
}

/**
 * Run yt-dlp. Resolves with { stdout } on success, rejects with a classified YtError.
 * `onLine(line, stream)` receives every output line (stdout and stderr).
 */
function runYtDlp(args, { onLine, signal, authMode = "none", stallMs = 0, bin = resolveTool("yt-dlp").path || "yt-dlp" } = {}) {
  return new Promise((resolve, reject) => {
    let proc;
    try {
      // Own process group so cancelling also stops yt-dlp's ffmpeg child.
      proc = spawn(bin, [...ytDlpBaseArgs(), ...args], { stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32", windowsHide: true });
    } catch (err) {
      return reject(new YtError("YTDLP_MISSING", `Couldn't start yt-dlp: ${err.message}`));
    }
    let stdout = "";
    let stderr = "";
    let stalled = false;
    let stallTimer = null;
    const noteActivity = () => {
      if (!stallMs) return;
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        stalled = true;
        killProcessTree(proc);
      }, stallMs);
    };
    noteActivity();
    // Decode as a stream: a multibyte character can be split across two chunks.
    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");
    const feed = (stream) => {
      let buf = "";
      return (text) => {
        noteActivity();
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
    const onAbort = () => killProcessTree(proc);
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
    proc.on("error", (err) => {
      clearTimeout(stallTimer);
      reject(err.code === "ENOENT" ? new YtError("YTDLP_MISSING", "yt-dlp isn't installed. Install it in Settings → YouTube.") : new YtError("YTDLP_FAILED", err.message));
    });
    proc.on("close", (code, sig) => {
      clearTimeout(stallTimer);
      if (signal) signal.removeEventListener("abort", onAbort);
      if (stalled) return reject(new YtError("DOWNLOAD_STALLED", "This download stopped making progress, so it was stopped. Try it again."));
      if (signal?.aborted || sig) return reject(new YtError("CANCELLED", "Cancelled."));
      if (code !== 0) {
        const err = classifyError(stderr, { authMode, exitCode: code });
        err.exitCode = code;
        err.stderrTail = stderr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(-15);
        console.warn(`[yt-dlp] exit ${code} (${err.code}) for: yt-dlp ${redactArgs(args).join(" ")}`);
        return reject(err);
      }
      resolve({ stdout });
    });
  });
}

let jsDiagnosis = null;
/** A new yt-dlp can fix what was diagnosed, so forget the old answer. */
function resetJsDiagnosis() {
  jsDiagnosis = null;
}
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
        proc = spawn(resolveTool("yt-dlp").path || "yt-dlp", [...ytDlpBaseArgs(), ...extraArgs, "-v", "--no-cache-dir", "--simulate", "--no-playlist", "-f", "bestaudio/best", "--print", "id", `https://www.youtube.com/watch?v=${videoId}`], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
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

module.exports = { hasSignInCookies, youtubeCookiesOnly, diagnoseJsChallenge, resetJsDiagnosis, BROWSERS, browserProfileDir, detectBrowsers, authArgs, redactArgs, classifyError, runYtDlp, YtError, cookieFilePath, credentialsDir };
