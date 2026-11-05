#!/usr/bin/env node
// Launches a packaged build with --smoke-test and reports its result.
// Usage: node scripts/run-smoke.cjs [path-to-executable]
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function findExecutable() {
  const release = path.join(__dirname, "..", "release");
  if (process.platform === "win32") return path.join(release, "win-unpacked", "b1tburn3r20.exe");
  if (process.platform === "darwin") {
    const dir = fs.readdirSync(release).find((d) => d.startsWith("mac"));
    return path.join(release, dir, "b1tburn3r20.app", "Contents", "MacOS", "b1tburn3r20");
  }
  return path.join(release, "linux-unpacked", "b1tburn3r20");
}

const exe = process.argv[2] || findExecutable();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "b1t-smoke-run-"));
const resultFile = path.join(tmp, "result.json");
const args = ["--smoke-test"];
if (process.env.CI && process.platform === "linux") args.push("--no-sandbox"); // CI runners have no usable sandbox
const child = spawn(exe, args, { stdio: "inherit", env: { ...process.env, B1T_SMOKE_RESULT: resultFile, B1T_SMOKE_TMP: tmp } });
const killer = setTimeout(() => {
  console.error("[smoke] timed out after 90 seconds");
  child.kill();
}, 90000);
child.on("error", (err) => {
  clearTimeout(killer);
  console.error(`[smoke] could not start ${exe}: ${err.message}`);
  process.exit(1);
});
child.on("exit", (code) => {
  clearTimeout(killer);
  let result = null;
  try {
    result = JSON.parse(fs.readFileSync(resultFile, "utf-8"));
  } catch {
    /* reported below */
  }
  // Child processes can hold the data folder open for a moment after the app exits.
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  console.log(JSON.stringify({ exitCode: code, result }, null, 2));
  process.exit(code === 0 && result && result.ok ? 0 : 1);
});
