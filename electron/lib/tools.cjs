// Finds the external programs the app runs: yt-dlp, ffmpeg, ffprobe, node and adb.
//
// The installer keeps a private copy of each in `<install root>/tools`, independent of any
// system package manager. So updating yt-dlp here can never require a system upgrade, and
// on macOS it works even though apps opened from Finder don't inherit the shell's PATH.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const defaults = () => ({ platform: process.platform, env: process.env, home: os.homedir(), exists: fs.existsSync });
const pathFor = (platform) => (platform === "win32" ? path.win32 : path.posix);
// Where package managers put programs, for apps launched without a shell's PATH.
const EXTRA_DIRS = { darwin: ["/opt/homebrew/bin", "/usr/local/bin"], linux: ["/usr/local/bin", "/usr/bin"] };

function installRoot(options = {}) {
  const { platform, env, home } = { ...defaults(), ...options };
  const p = pathFor(platform);
  if (env.B1T_INSTALL_ROOT) return env.B1T_INSTALL_ROOT;
  if (platform === "win32") return p.join(env.LOCALAPPDATA || p.join(home, "AppData", "Local"), "b1tburn3r20");
  if (platform === "darwin") return p.join(home, "Library", "Application Support", "b1tburn3r20-install");
  return p.join(env.XDG_DATA_HOME || p.join(home, ".local", "share"), "b1tburn3r20");
}

function toolsDir(options = {}) {
  const { platform } = { ...defaults(), ...options };
  return pathFor(platform).join(installRoot(options), "tools");
}

function exeName(name, platform = process.platform) {
  return platform === "win32" ? `${name}.exe` : name;
}

function findOnPath(name, options = {}) {
  const { platform, env, exists } = { ...defaults(), ...options };
  const p = pathFor(platform);
  const dirs = [...(env.PATH || env.Path || "").split(p.delimiter), ...(EXTRA_DIRS[platform] || [])].filter(Boolean);
  const extensions = platform === "win32" ? (env.PATHEXT || ".EXE;.CMD;.BAT").split(";").filter(Boolean) : [""];
  for (const dir of dirs) {
    for (const ext of extensions) {
      const candidate = p.join(dir, name + ext);
      if (exists(candidate)) return candidate;
    }
  }
  return null;
}

/** Order: explicit override, the app's private copy, then whatever the system has. */
function resolveTool(name, options = {}) {
  const { platform, env, exists } = { ...defaults(), ...options };
  if (name === "yt-dlp" && env.B1T_YTDLP) return { name, path: env.B1T_YTDLP, source: "env" };
  const privateCopy = pathFor(platform).join(toolsDir(options), exeName(name, platform));
  if (exists(privateCopy)) return { name, path: privateCopy, source: "private" };
  const onPath = findOnPath(name, options);
  if (onPath) return { name, path: onPath, source: "path" };
  return { name, path: null, source: "missing" };
}

// What Windows reports when a program can't run at all. Exit codes alone mean nothing to a person.
const WINDOWS_CRASHES = {
  0xc0000135: "couldn't start because a Windows file it needs is missing. Run Windows Update, and install the latest Microsoft Visual C++ Redistributable",
  0xc000007b: "couldn't start because a Windows file it needs is damaged or the wrong type. Run Windows Update, and install the latest Microsoft Visual C++ Redistributable",
  0xc0000142: "couldn't start because Windows failed to load a file it needs. Restart the computer and run Windows Update",
  0xc0000005: "crashed as it ran. Antivirus software is a common cause",
  0xc000001d: "crashed because this computer's processor doesn't support something it needs",
};

/** Finishes the sentence "<tool> ...". */
function explainExit(code) {
  return WINDOWS_CRASHES[code >>> 0] || `stopped with exit code ${code}`;
}

/** Arguments every yt-dlp run needs, whichever copy of the tools is being used. */
function ytDlpBaseArgs(options = {}) {
  const { platform } = { ...defaults(), ...options };
  const args = [
    "--ignore-config", // a stray user config must not change where or how files are saved
    "--encoding", "utf-8", // otherwise piped output uses the Windows code page and garbles non-ASCII paths
  ];
  const node = resolveTool("node", options);
  if (node.path) args.push("--js-runtimes", `node:${node.path}`); // yt-dlp only enables Deno by default
  const ffmpeg = resolveTool("ffmpeg", options);
  if (ffmpeg.source === "private") args.push("--ffmpeg-location", pathFor(platform).dirname(ffmpeg.path));
  return args;
}

/** Stops a process and anything it started: yt-dlp's ffmpeg child would otherwise keep running. */
function killProcessTree(proc, { platform = process.platform, spawnFn = spawn } = {}) {
  if (!proc || !proc.pid) return;
  try {
    if (platform === "win32") spawnFn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }).on("error", () => proc.kill());
    else process.kill(-proc.pid, "SIGTERM");
  } catch {
    proc.kill("SIGTERM");
  }
}

function toolStatus(options = {}) {
  return Object.fromEntries(["yt-dlp", "ffmpeg", "ffprobe", "node", "adb"].map((name) => [name, resolveTool(name, options)]));
}

module.exports = { explainExit, installRoot, toolsDir, exeName, findOnPath, resolveTool, ytDlpBaseArgs, killProcessTree, toolStatus };
