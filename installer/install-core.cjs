#!/usr/bin/env node
// The part of the installer that's the same on every OS. install.sh and install.ps1 do the
// preflight and fetch a pinned Node, then run this with it. Nothing else is assumed to exist.
//
// Usage: node install-core.cjs --source <dir> --root <dir> [--yes] [--force] [--no-launch]
//        node install-core.cjs --root <dir> --uninstall [--yes]
const { execFileSync, spawn, spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const zlib = require("zlib");

const APP = "b1tburn3r20";

function parseArgs(argv) {
  const opts = { yes: false, force: false, uninstall: false, launch: true, source: null, root: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes") opts.yes = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--uninstall") opts.uninstall = true;
    else if (a === "--no-launch") opts.launch = false;
    else if (a === "--source") opts.source = argv[++i];
    else if (a === "--root") opts.root = argv[++i];
    else throw new Error(`Unknown option: ${a}`);
  }
  if (!opts.root) throw new Error("--root is required");
  if (!opts.uninstall && !opts.source) throw new Error("--source is required");
  return opts;
}

/** Plain x.y.z comparison. Prerelease suffixes are ignored. */
function compareVersions(a, b) {
  const parts = (v) => String(v).split("-")[0].split(".").map((n) => Number(n) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) {
    const diff = (x[i] || 0) - (y[i] || 0);
    if (diff) return Math.sign(diff);
  }
  return 0;
}

/** Older builds refuse data files written by newer ones, so a downgrade could lock someone out of their library. */
function checkDowngrade(installed, incoming, force) {
  if (!installed || force || compareVersions(incoming, installed) >= 0) return;
  throw new Error(`Version ${installed} is installed, and ${incoming} is older. Older versions can't read newer data, so this was stopped. Use --force if you're sure.`);
}

/** Windows on ARM has no native ffmpeg build here, but runs the x64 one under emulation. */
function toolKey(platform, arch) {
  if (platform === "win32") return "win32-x64";
  return `${platform}-${arch}`;
}

function toolAsset(manifest, name, platform, arch) {
  const key = toolKey(platform, arch);
  const hash = manifest.ffmpeg.sha256[`${name}-${key}`];
  if (!hash) throw new Error(`No ${name} build is known for ${key}.`);
  return { url: `${manifest.ffmpeg.base}/${name}-${key}.gz`, sha256: hash };
}

function exeName(name, platform) {
  return platform === "win32" ? `${name}.exe` : name;
}

/** Where everything goes. Per-user everywhere, so no admin rights are needed. */
function paths(root, { platform = process.platform, home = os.homedir(), env = process.env } = {}) {
  const p = platform === "win32" ? path.win32 : path.posix;
  const result = {
    root,
    tools: p.join(root, "tools"),
    versionFile: p.join(root, "VERSION"),
    installerDir: p.join(root, "installer"),
    app: p.join(root, "app"),
  };
  if (platform === "darwin") {
    result.app = p.join(home, "Applications", `${APP}.app`);
    result.exe = p.join(result.app, "Contents", "MacOS", APP);
    result.userData = p.join(home, "Library", "Application Support", APP);
  } else if (platform === "win32") {
    result.exe = p.join(result.app, `${APP}.exe`);
    result.userData = p.join(env.APPDATA || p.join(home, "AppData", "Roaming"), APP);
    result.shortcut = p.join(env.APPDATA || p.join(home, "AppData", "Roaming"), "Microsoft", "Windows", "Start Menu", "Programs", `${APP}.lnk`);
  } else {
    result.exe = p.join(result.app, APP);
    result.userData = p.join(env.XDG_CONFIG_HOME || p.join(home, ".config"), APP);
    const dataHome = env.XDG_DATA_HOME || p.join(home, ".local", "share");
    result.desktopFile = p.join(dataHome, "applications", `${APP}.desktop`);
    result.binLink = p.join(home, ".local", "bin", APP);
  }
  return result;
}

function desktopEntry(exe, icon) {
  // Field codes aren't needed; a path with spaces must be quoted for the Exec key.
  return ["[Desktop Entry]", "Type=Application", `Name=${APP}`, "Comment=Music player", `Exec="${exe}"`, ...(icon ? [`Icon=${icon}`] : []), "Terminal=false", "Categories=AudioVideo;Audio;Player;", ""].join("\n");
}

function step(message) {
  console.log(`\n==> ${message}`);
}

async function ask(question, fallback, opts) {
  if (opts.yes) return fallback;
  if (!process.stdin.isTTY) return fallback;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(`${question} [${fallback ? "Y/n" : "y/N"}] `, resolve));
  rl.close();
  const text = answer.trim().toLowerCase();
  return text ? text === "y" || text === "yes" : fallback;
}

async function downloadVerified(url, sha256) {
  const res = await fetch(url, { headers: { "User-Agent": `${APP}-installer` }, signal: AbortSignal.timeout(10 * 60 * 1000) });
  if (!res.ok) throw new Error(`download failed (${res.status}): ${url}`);
  const data = Buffer.from(await res.arrayBuffer());
  const actual = crypto.createHash("sha256").update(data).digest("hex");
  if (actual !== sha256) throw new Error(`checksum mismatch for ${url}`);
  return data;
}

/** Runs a step with the private Node first on PATH. A stale NODE_ENV would drop dev dependencies. */
function run(command, args, { cwd, env = {} } = {}) {
  const nodeDir = path.dirname(process.execPath);
  const merged = { ...process.env, ...env, PATH: `${nodeDir}${path.delimiter}${process.env.PATH || ""}` };
  delete merged.NODE_ENV;
  delete merged.Path; // Windows keeps PATH under this spelling too; two entries would conflict
  const result = spawnSync(command, args, { cwd, env: merged, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} ${args.slice(0, 2).join(" ")} failed with exit code ${result.status}`);
}

function isAppRunning(platform) {
  try {
    if (platform === "win32") return execFileSync("tasklist", ["/FI", `IMAGENAME eq ${APP}.exe`, "/NH"], { encoding: "utf8", windowsHide: true }).toLowerCase().includes(`${APP}.exe`);
    execFileSync("pgrep", ["-x", APP], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** ffmpeg, Node and yt-dlp are only needed for YouTube, so a failure here warns and carries on. */
async function installTools(p, source, platform, arch) {
  const warnings = [];
  fs.mkdirSync(p.tools, { recursive: true });
  const nodeTarget = path.join(p.tools, exeName("node", platform));
  try {
    if (path.resolve(process.execPath) !== path.resolve(nodeTarget)) {
      fs.rmSync(nodeTarget, { force: true });
      fs.copyFileSync(process.execPath, nodeTarget);
      fs.chmodSync(nodeTarget, 0o755);
    }
  } catch (err) {
    warnings.push(`Node runtime for yt-dlp: ${err.message}`);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(source, "installer", "tools-manifest.json"), "utf-8"));
  for (const name of ["ffmpeg", "ffprobe"]) {
    const target = path.join(p.tools, exeName(name, platform));
    const stamp = `${target}.version`;
    try {
      if (fs.existsSync(target) && fs.existsSync(stamp) && fs.readFileSync(stamp, "utf-8") === manifest.ffmpeg.version) continue;
      console.log(`    ${name}…`);
      const asset = toolAsset(manifest, name, platform, arch);
      const data = zlib.gunzipSync(await downloadVerified(asset.url, asset.sha256));
      const temp = `${target}.tmp`;
      fs.writeFileSync(temp, data, { mode: 0o755 });
      fs.renameSync(temp, target);
      fs.writeFileSync(stamp, manifest.ffmpeg.version);
    } catch (err) {
      warnings.push(`${name}: ${err.message}`);
    }
  }
  try {
    console.log("    yt-dlp…");
    const { createYtDlpUpdater } = require(path.join(source, "electron", "lib", "ytdlpUpdate.cjs"));
    const yt = path.join(p.tools, exeName("yt-dlp", platform));
    const updater = createYtDlpUpdater({ resolve: () => ({ name: "yt-dlp", path: fs.existsSync(yt) ? yt : null, source: fs.existsSync(yt) ? "private" : "missing" }), toolsDir: p.tools, platform, arch });
    const checked = await updater.check();
    // A copy that won't run gets replaced too, in case the file itself is damaged.
    if (checked.status === "available" || (checked.status === "error" && !checked.current)) {
      const done = await updater.update();
      if (done.status === "error") warnings.push(done.error);
    } else if (checked.status === "unknown" && !checked.current) warnings.push("yt-dlp: couldn't reach GitHub");
  } catch (err) {
    warnings.push(`yt-dlp: ${err.message}`);
  }
  return warnings;
}

function build(source, platform) {
  const npmCli = path.join(path.dirname(process.execPath), ...(platform === "win32" ? ["node_modules", "npm", "bin", "npm-cli.js"] : ["..", "lib", "node_modules", "npm", "bin", "npm-cli.js"]));
  const env = { npm_config_fund: "false", npm_config_audit: "false", npm_config_update_notifier: "false" };
  run(process.execPath, [npmCli, "ci", "--include=dev"], { cwd: source, env });
  run(process.execPath, [path.join(source, "node_modules", "vite", "bin", "vite.js"), "build"], { cwd: source, env });
  // macOS: signed ad hoc below, since there's no identity to sign with on a user's Mac.
  const builderArgs = [path.join(source, "node_modules", "electron-builder", "cli.js"), "--dir", "--config", "electron-builder.config.cjs"];
  run(process.execPath, builderArgs, { cwd: source, env: { ...env, ...(platform === "darwin" ? { B1T_MAC_UNSIGNED: "1" } : {}) } });
  const release = path.join(source, "release");
  const dir = fs.readdirSync(release).find((d) => /unpacked$|^mac/.test(d) && fs.statSync(path.join(release, d)).isDirectory());
  if (!dir) throw new Error("The build finished, but its output folder wasn't found.");
  return platform === "darwin" ? path.join(release, dir, `${APP}.app`) : path.join(release, dir);
}

/** Ubuntu 24.04 and others stop Electron's sandbox from starting unless its helper is set up. Never falls back to --no-sandbox. */
async function setupLinuxSandbox(built, opts) {
  const read = (file) => {
    try {
      return fs.readFileSync(file, "utf-8").trim();
    } catch {
      return null;
    }
  };
  const restricted = read("/proc/sys/kernel/apparmor_restrict_unprivileged_userns") === "1" || read("/proc/sys/kernel/unprivileged_userns_clone") === "0";
  if (!restricted) return;
  const helper = path.join(built, "chrome-sandbox");
  const command = `sudo chown root:root "${helper}" && sudo chmod 4755 "${helper}"`;
  console.log("\nThis system restricts the sandbox that keeps the app secure. Its helper needs admin rights to run:");
  console.log(`  ${command}`);
  if (!(await ask("Run that now?", false, opts))) {
    console.log("Skipped. If the app doesn't start, run the command above after moving on.");
    return;
  }
  run("sudo", ["chown", "root:root", helper]);
  run("sudo", ["chmod", "4755", helper]);
}

function smokeTest(source, exe) {
  run(process.execPath, [path.join(source, "scripts", "run-smoke.cjs"), exe], { cwd: source });
}

/** Replaces the old install only once the new one is known to work, and restores it on failure. */
function swapIntoPlace(built, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const old = `${target}.old`;
  fs.rmSync(old, { recursive: true, force: true });
  const hadOld = fs.existsSync(target);
  if (hadOld) fs.renameSync(target, old);
  try {
    try {
      fs.renameSync(built, target);
    } catch (err) {
      if (err.code !== "EXDEV") throw err; // a different drive: renaming isn't possible
      fs.cpSync(built, target, { recursive: true, verbatimSymlinks: true });
    }
  } catch (err) {
    fs.rmSync(target, { recursive: true, force: true });
    if (hadOld) fs.renameSync(old, target);
    throw err;
  }
  fs.rmSync(old, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

function escapePs(s) {
  return String(s).replace(/'/g, "''");
}

function createWindowsShortcuts(p, version, source) {
  // Copied out of the app, because Windows can't read an icon from inside its archive.
  const { windowsShortcutIcon } = require(path.join(source, "electron", "lib", "appIcon.cjs"));
  const supplied = windowsShortcutIcon(path.join(source, "public"));
  const iconCopy = path.join(p.root, "favicon.ico");
  fs.rmSync(iconCopy, { force: true });
  if (supplied) fs.copyFileSync(supplied, iconCopy);
  const shortcut = [
    "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('" + escapePs(p.shortcut) + "')",
    "$s.TargetPath = '" + escapePs(p.exe) + "'",
    "$s.WorkingDirectory = '" + escapePs(p.app) + "'",
    "$s.Description = 'Music player'",
    ...(supplied ? ["$s.IconLocation = '" + escapePs(iconCopy) + "'"] : []),
    "$s.Save()",
  ].join("; ");
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", shortcut], { stdio: "inherit", windowsHide: true });
  const key = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP}`;
  const uninstall = `"${path.join(p.tools, "node.exe")}" "${path.join(p.installerDir, "install-core.cjs")}" --root "${p.root}" --uninstall`;
  const values = { DisplayName: APP, DisplayVersion: version, InstallLocation: p.root, UninstallString: uninstall, DisplayIcon: supplied ? iconCopy : p.exe, Publisher: APP };
  for (const [name, value] of Object.entries(values)) execFileSync("reg", ["add", key, "/v", name, "/t", "REG_SZ", "/d", value, "/f"], { stdio: "ignore", windowsHide: true });
  for (const name of ["NoModify", "NoRepair"]) execFileSync("reg", ["add", key, "/v", name, "/t", "REG_DWORD", "/d", "1", "/f"], { stdio: "ignore", windowsHide: true });
}

function createLinuxShortcuts(p, source) {
  const { linuxIconFile } = require(path.join(source, "electron", "lib", "appIcon.cjs"));
  const chosen = linuxIconFile(path.join(source, "public"));
  let iconPath = "";
  if (chosen) {
    iconPath = path.join(p.root, chosen.name);
    fs.copyFileSync(chosen.source, iconPath);
  }
  fs.mkdirSync(path.dirname(p.desktopFile), { recursive: true });
  fs.writeFileSync(p.desktopFile, desktopEntry(p.exe, iconPath));
  fs.mkdirSync(path.dirname(p.binLink), { recursive: true });
  fs.rmSync(p.binLink, { force: true });
  fs.symlinkSync(p.exe, p.binLink);
  spawnSync("update-desktop-database", [path.dirname(p.desktopFile)], { stdio: "ignore" });
}

function launch(p) {
  const child = spawn(p.exe, [], { detached: true, stdio: "ignore", windowsHide: false });
  child.on("error", () => console.log(`Couldn't open it automatically. Find it in your apps, or run: ${p.exe}`));
  child.unref();
}

async function install(opts, { platform = process.platform, arch = process.arch } = {}) {
  const p = paths(opts.root, { platform });
  const source = path.resolve(opts.source);
  const version = JSON.parse(fs.readFileSync(path.join(source, "package.json"), "utf-8")).version;
  const installed = fs.existsSync(p.versionFile) ? fs.readFileSync(p.versionFile, "utf-8").trim() : null;
  checkDowngrade(installed, version, opts.force);
  if (isAppRunning(platform)) throw new Error(`${APP} is running. Close it, then run this again.`);

  step("Installing tools (used for YouTube only)");
  const warnings = await installTools(p, source, platform, arch);

  step("Building the app. This takes a few minutes the first time");
  const built = build(source, platform);
  if (platform === "darwin") run("codesign", ["--force", "--deep", "--sign", "-", built]); // arm64 refuses to run unsigned code
  if (platform === "linux") await setupLinuxSandbox(built, opts);

  step("Checking that the build works");
  smokeTest(source, platform === "darwin" ? path.join(built, "Contents", "MacOS", APP) : path.join(built, exeName(APP, platform)));

  step("Installing");
  swapIntoPlace(built, p.app);
  fs.mkdirSync(p.installerDir, { recursive: true });
  fs.copyFileSync(__filename, path.join(p.installerDir, "install-core.cjs"));
  fs.writeFileSync(p.versionFile, version);
  if (platform === "win32") createWindowsShortcuts(p, version, source);
  if (platform === "linux") createLinuxShortcuts(p, source);

  console.log(`\n${APP} ${version} is installed.`);
  if (warnings.length) {
    console.log("\nThe music player works, but YouTube downloads may not until these are fixed. You can install yt-dlp from inside the app, under Settings → YouTube.");
    for (const w of warnings) console.log(`  - ${w}`);
  }
  if (opts.launch && (await ask("Open it now?", true, { ...opts, yes: false }))) launch(p);
}

function removeWindowsEntries(p) {
  fs.rmSync(p.shortcut, { force: true });
  spawnSync("reg", ["delete", `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP}`, "/f"], { stdio: "ignore", windowsHide: true });
}

async function uninstall(opts, { platform = process.platform } = {}) {
  const p = paths(opts.root, { platform });
  if (isAppRunning(platform)) throw new Error(`${APP} is running. Close it, then run this again.`);
  step(`Removing ${APP}`);
  // Your music is never touched: it lives in your own Music folder, outside everything below.
  if (platform === "win32") removeWindowsEntries(p);
  if (platform === "linux") for (const file of [p.desktopFile, p.binLink]) fs.rmSync(file, { force: true });
  fs.rmSync(p.app, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });

  if (await ask(`Also delete your playlists, likes, history and saved YouTube credentials (${p.userData})? Your music files are kept either way.`, false, opts)) {
    fs.rmSync(p.userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    console.log("Your app data was deleted.");
  } else {
    console.log(`Your app data was kept in ${p.userData}.`);
  }

  // This script is running from inside the install folder. Windows can't delete a running
  // program, so a separate process removes the rest just after this one exits.
  if (platform === "win32") {
    // ping is the waiting tool here because `timeout` refuses to run without a console. Verbatim
    // arguments, because Node's \" escaping means nothing to cmd and would mangle the path.
    spawn("cmd.exe", ["/d", "/s", "/c", `"ping -n 3 127.0.0.1 >nul & rmdir /s /q "${p.root}""`], {
      cwd: os.tmpdir(), // a process can't delete the folder it's running in
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      windowsVerbatimArguments: true,
    }).unref();
  } else {
    fs.rmSync(p.root, { recursive: true, force: true });
  }
  console.log(`${APP} was removed. Your music was not touched.`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.uninstall) await uninstall(opts);
  else await install(opts);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\nInstall stopped: ${err.message}\nNothing was changed in your existing install, and your music and data are safe.`);
    process.exit(1);
  });
}

module.exports = { parseArgs, compareVersions, checkDowngrade, toolKey, toolAsset, exeName, paths, desktopEntry, swapIntoPlace };
