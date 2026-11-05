#!/usr/bin/env node
// Electron's postinstall can exit 0 without extracting anything: versions before 40.10 did
// this on Node 26, leaving `npm ci` looking successful with no Electron binary. Fail loudly
// here, because nothing downstream would explain what went wrong.
const fs = require("fs");
const path = require("path");

if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) process.exit(0);

const dir = path.join(__dirname, "..", "node_modules", "electron");
function installed() {
  try {
    const rel = fs.readFileSync(path.join(dir, "path.txt"), "utf-8").trim();
    return Boolean(rel) && fs.existsSync(path.join(dir, "dist", rel));
  } catch {
    return false;
  }
}

if (!installed()) {
  console.error(`
Electron did not install correctly (node_modules/electron/dist has no executable), on Node ${process.version}.
Delete node_modules and run npm ci again. If it happens again, please report it, with your Node version.
`);
  process.exit(1);
}
