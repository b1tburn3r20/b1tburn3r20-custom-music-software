// `--smoke-test`: proves a packaged build really works, then exits. Used by the
// installer before it replaces an existing install, and by CI.
//
// The MP3 check matters because readAudioMetadata never throws: if music-metadata
// failed to load from the packaged app, every song would quietly become "Unknown Artist".
const fs = require("fs");
const os = require("os");
const path = require("path");
const { readAudioMetadata } = require("./lib/media.cjs");

const SMOKE_TITLE = "b1t smoke title";
const RENDERER_TIMEOUT_MS = 45000;

function isSmokeTest(argv = process.argv) {
  return argv.includes("--smoke-test");
}

const musicDirOf = (dir) => path.join(dir, "Music");

/** Keep a smoke run away from the user's real library and Music folder, even with the app already installed. */
function isolateUserData() {
  const dir = fs.mkdtempSync(path.join(process.env.B1T_SMOKE_TMP || os.tmpdir(), "b1t-smoke-"));
  process.env.B1T_USERDATA_DIR = path.join(dir, "data");
  process.env.B1T_LEGACY_DIR = path.join(dir, "no-legacy");
  fs.mkdirSync(musicDirOf(dir));
  fs.writeFileSync(path.join(musicDirOf(dir), "existing song.mp3"), buildTestMp3());
  return dir;
}

/** A minimal real MP3: an ID3v2.3 title tag followed by a few silent MPEG-1 Layer III frames. */
function buildTestMp3(title = SMOKE_TITLE) {
  const text = Buffer.concat([Buffer.from([0]), Buffer.from(title, "latin1")]);
  const frameHeader = Buffer.alloc(10);
  frameHeader.write("TIT2", 0, "latin1");
  frameHeader.writeUInt32BE(text.length, 4);
  const body = Buffer.concat([frameHeader, text]);
  const syncsafe = [21, 14, 7, 0].map((shift) => (body.length >> shift) & 0x7f);
  const id3 = Buffer.concat([Buffer.from("ID3", "latin1"), Buffer.from([3, 0, 0, ...syncsafe]), body]);
  const frame = Buffer.alloc(417); // 128 kbps at 44.1 kHz
  frame.set([0xff, 0xfb, 0x90, 0x00]);
  return Buffer.concat([id3, ...Array(8).fill(frame)]);
}

async function checkMetadata(dir) {
  const file = path.join(dir, "filename-fallback.mp3");
  fs.writeFileSync(file, buildTestMp3());
  const { metadata } = await readAudioMetadata(file);
  if (metadata.title !== SMOKE_TITLE) throw new Error(`music-metadata didn't read the tag (got "${metadata.title}")`);
}

async function checkRenderer(win) {
  await new Promise((resolve, reject) => {
    if (!win.webContents.isLoading()) return resolve();
    win.webContents.once("did-finish-load", resolve);
    win.webContents.once("did-fail-load", (_e, code, desc) => reject(new Error(`renderer failed to load: ${desc} (${code})`)));
  });
  const deadline = Date.now() + RENDERER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const state = await win.webContents.executeJavaScript(
      `({ mounted: (document.getElementById("root")?.childElementCount || 0) > 0, api: typeof window.api === "object" })`,
    );
    if (state.mounted && state.api) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("the interface never appeared");
}

/**
 * What a new user gets: with no folder chosen, the OS Music folder is used and the song
 * already in it shows up with its tags. Covers bootstrap, folder selection and scanning.
 */
async function checkDefaultFolder(win, dir) {
  const expected = musicDirOf(dir);
  const deadline = Date.now() + RENDERER_TIMEOUT_MS;
  let library = null;
  while (Date.now() < deadline) {
    const reply = await win.webContents.executeJavaScript(`window.api.library.get()`);
    library = reply && reply.data;
    if (library && library.rootDir && library.songs.length) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!library || library.rootDir !== expected) throw new Error(`music folder is "${library && library.rootDir}", expected the OS Music folder`);
  const titles = library.songs.map((s) => s.metadata && s.metadata.title);
  if (!titles.includes(SMOKE_TITLE)) throw new Error(`the song in the Music folder wasn't found (songs: ${JSON.stringify(titles)})`);
}

/** Calls the main process through the real preload, past the IPC sender check. */
async function checkIpc(win) {
  const reply = await win.webContents.executeJavaScript(`window.api.library.get()`);
  if (!reply || !reply.ok) throw new Error(`IPC call refused: ${reply && reply.error ? reply.error.message : "no reply"}`);
}

const policyViolations = [];

/** Attach before the page loads: a blocked script or style would otherwise go unnoticed. */
function watchForPolicyViolations(win) {
  win.webContents.on("console-message", (event) => {
    if (/Content Security Policy/i.test(event.message || "")) policyViolations.push(event.message);
  });
}

async function checkPolicy() {
  if (policyViolations.length) throw new Error(policyViolations.join(" | "));
}

/** Runs every check. Never throws: returns the outcome for the caller to report. */
async function runSmokeTest({ win, dir }) {
  const result = { ok: false, platform: process.platform, arch: process.arch, electron: process.versions.electron, checks: {} };
  for (const [name, fn] of [
    ["metadata", () => checkMetadata(dir)],
    ["renderer", () => checkRenderer(win)],
    ["ipc", () => checkIpc(win)],
    ["defaultFolder", () => checkDefaultFolder(win, dir)],
    ["policy", checkPolicy],
  ]) {
    try {
      await fn();
      result.checks[name] = "ok";
    } catch (err) {
      result.checks[name] = String(err.message || err);
    }
  }
  result.ok = Object.values(result.checks).every((v) => v === "ok");
  return result;
}

function reportSmokeResult(result) {
  console.log(`[smoke] ${JSON.stringify(result)}`);
  if (process.env.B1T_SMOKE_RESULT) fs.writeFileSync(process.env.B1T_SMOKE_RESULT, JSON.stringify(result));
}

module.exports = { musicDirOf, isSmokeTest, isolateUserData, runSmokeTest, reportSmokeResult, watchForPolicyViolations, buildTestMp3, SMOKE_TITLE };
