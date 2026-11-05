// Keeps the app's private yt-dlp current without touching anything else on the system.
// YouTube changes often break older versions, and a system package manager can't always
// update yt-dlp alone (on Arch that means a full system upgrade). This replaces one file.
const { execFile } = require("child_process");
const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
const { exeName } = require("./tools.cjs");

const RELEASE_API = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";
const DOWNLOAD_BASE = "https://github.com/yt-dlp/yt-dlp/releases/download";
const CHECK_TIMEOUT_MS = 5000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const VERSION_TIMEOUT_MS = 60000; // the standalone binary unpacks itself on first run
const IDLE_POLL_MS = 2000;
const VERSION_RE = /^\d{4}\.\d{1,2}\.\d{1,2}(\.\d+)?$/;
const HEADERS = { "User-Agent": "b1tburn3r20-music-app" };

/** Versions are dates, with an optional suffix for a second release that day: 2026.10.26.1. */
function compareVersions(a, b) {
  const parts = (v) => String(v).split(".").map(Number);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diff = (x[i] || 0) - (y[i] || 0);
    if (diff) return Math.sign(diff);
  }
  return 0;
}

function assetName(platform = process.platform, arch = process.arch) {
  if (platform === "win32") return arch === "arm64" ? "yt-dlp_arm64.exe" : "yt-dlp.exe";
  if (platform === "darwin") return "yt-dlp_macos";
  return arch === "arm64" ? "yt-dlp_linux_aarch64" : "yt-dlp_linux";
}

/** Finds a file's hash in a SHA2-256SUMS listing ("<hash>  <name>" or "<hash> *<name>"). */
function findChecksum(sums, asset) {
  for (const line of String(sums).split(/\r?\n/)) {
    const m = /^([a-f0-9]{64})\s+\*?(.+)$/i.exec(line.trim());
    if (m && m[2] === asset) return m[1].toLowerCase();
  }
  return null;
}

function readVersion(file) {
  return new Promise((resolve, reject) => {
    execFile(file, ["--version"], { timeout: VERSION_TIMEOUT_MS, windowsHide: true }, (err, stdout) => {
      if (err) return reject(err);
      const version = String(stdout).trim();
      if (!VERSION_RE.test(version)) return reject(new Error(`unexpected version output "${version.slice(0, 60)}"`));
      resolve(version);
    });
  });
}

function createYtDlpUpdater({
  resolve,
  toolsDir,
  isBusy = () => false,
  onInstalled = () => {},
  emit = () => {},
  fetchFn = fetch,
  versionOf = readVersion,
  platform = process.platform,
  arch = process.arch,
  idlePollMs = IDLE_POLL_MS,
}) {
  let state = { status: "idle", current: null, latest: null, source: null };
  let updating = false;
  const set = (patch) => {
    state = { ...state, ...patch };
    emit(state);
    return state;
  };

  async function latestVersion() {
    const res = await fetchFn(RELEASE_API, { headers: { ...HEADERS, Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    const { tag_name: tag } = await res.json();
    if (!VERSION_RE.test(String(tag))) throw new Error(`unexpected release tag "${String(tag).slice(0, 40)}"`);
    return tag;
  }

  /** Never throws, and an unreachable network just means no suggestion this launch. */
  async function check() {
    if (updating) return state;
    const tool = resolve();
    const current = tool.path ? await versionOf(tool.path).catch(() => null) : null;
    set({ status: "checking", current, source: tool.source, error: null });
    // Someone who pointed B1T_YTDLP at their own copy manages it themselves.
    if (tool.source === "env") return set({ status: "unmanaged", latest: null });
    let latest;
    try {
      latest = await latestVersion();
    } catch (err) {
      console.info(`[yt-dlp] update check skipped: ${err.message}`);
      return set({ status: "unknown", latest: null });
    }
    return set({ latest, status: !current || compareVersions(latest, current) > 0 ? "available" : "up-to-date" });
  }

  async function downloadVerified(tag, asset, dest) {
    const sumsRes = await fetchFn(`${DOWNLOAD_BASE}/${tag}/SHA2-256SUMS`, { headers: HEADERS, signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!sumsRes.ok) throw new Error(`couldn't get the checksum list (${sumsRes.status})`);
    const expected = findChecksum(await sumsRes.text(), asset);
    if (!expected) throw new Error(`the release lists no checksum for ${asset}`);

    const res = await fetchFn(`${DOWNLOAD_BASE}/${tag}/${asset}`, { headers: HEADERS, signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!res.ok || !res.body) throw new Error(`download failed (${res.status})`);
    const total = Number(res.headers.get("content-length")) || 0;
    const hash = crypto.createHash("sha256");
    const out = await fs.open(dest, "w", 0o755);
    let received = 0;
    let shown = -1;
    try {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        hash.update(value);
        await out.write(value);
        received += value.length;
        const percent = total ? Math.floor((received / total) * 100) : null;
        if (percent !== shown) {
          shown = percent;
          set({ percent });
        }
      }
    } finally {
      await out.close();
    }
    if (hash.digest("hex") !== expected) throw new Error("the download failed its checksum, so it was discarded");
    await fs.chmod(dest, 0o755);
  }

  async function waitUntilIdle() {
    if (isBusy()) set({ status: "waiting" }); // Windows can't replace a running .exe
    while (isBusy()) await new Promise((r) => setTimeout(r, idlePollMs));
  }

  /** Puts the verified file in place, keeping the old one until the new one is in. */
  async function swap(fresh, target) {
    const previous = `${target}.previous`;
    await fs.rm(previous, { force: true });
    const hadOld = await fs.rename(target, previous).then(() => true, (err) => {
      if (err.code === "ENOENT") return false;
      throw err;
    });
    try {
      await fs.rename(fresh, target);
    } catch (err) {
      if (hadOld) await fs.rename(previous, target).catch(() => {});
      throw err;
    }
  }

  /** Replaces only the app's private yt-dlp. Never runs a package manager, and never needs admin rights. */
  async function update() {
    if (updating) return state;
    if (resolve().source === "env") return set({ status: "unmanaged" });
    updating = true;
    const target = path.join(toolsDir, exeName("yt-dlp", platform));
    // Keep the .exe extension so Windows will run the new file for the test below.
    const fresh = path.join(toolsDir, `yt-dlp-update-${process.pid}${platform === "win32" ? ".exe" : ""}`);
    try {
      set({ status: "downloading", percent: 0, error: null });
      const tag = state.latest || (await latestVersion());
      await fs.mkdir(toolsDir, { recursive: true });
      await downloadVerified(tag, assetName(platform, arch), fresh);
      set({ status: "installing", percent: null, latest: tag });
      const version = await versionOf(fresh);
      if (compareVersions(version, tag) !== 0) throw new Error(`the new file reports version ${version}, expected ${tag}`);
      await waitUntilIdle();
      set({ status: "installing" });
      await swap(fresh, target);
      onInstalled();
      return set({ status: "up-to-date", current: version, source: "private", percent: null });
    } catch (err) {
      await fs.rm(fresh, { force: true }).catch(() => {});
      console.warn(`[yt-dlp] update failed: ${err.message}`);
      return set({ status: "error", percent: null, error: `Couldn't update yt-dlp: ${err.message}. Your current version is unchanged.` });
    } finally {
      updating = false;
    }
  }

  return { check, update, getState: () => state };
}

module.exports = { createYtDlpUpdater, compareVersions, assetName, findChecksum };
