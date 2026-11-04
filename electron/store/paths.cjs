// Where data lives, plus the one-time copy from the generic dev folder.
//
// Before the overhaul, `electron electron/main.cjs` stored everything in
// ~/.config/Electron (shared by every Electron dev app), while packaged builds
// used ~/.config/b1tburn3r20. We now pin userData to one place and *copy*
// (never move) the old data over on first run. The old folder is left intact.
const fs = require("fs").promises;
const path = require("path");
const { exists } = require("../lib/atomic.cjs");

const LEGACY_ITEMS = ["music-cache.json", "playlists.json", "thumbnails", "Local Storage"];
const MARKER = ".legacy-copy.json";

function configureUserData(app) {
  const target = process.env.B1T_USERDATA_DIR || path.join(app.getPath("appData"), "b1tburn3r20");
  app.setPath("userData", target);
  return target;
}

async function copyLegacyUserData(app) {
  const target = app.getPath("userData");
  const legacyDir = process.env.B1T_LEGACY_DIR || path.join(app.getPath("appData"), "Electron");
  const markerPath = path.join(target, MARKER);
  if (await exists(markerPath)) return { copied: [], skipped: true };
  await fs.mkdir(target, { recursive: true });

  const copied = [];
  if (path.resolve(legacyDir) !== path.resolve(target) && (await exists(path.join(legacyDir, "music-cache.json")) || await exists(path.join(legacyDir, "playlists.json")))) {
    for (const item of LEGACY_ITEMS) {
      const src = path.join(legacyDir, item);
      const dst = path.join(target, item);
      if (!(await exists(src))) continue;
      if (await exists(dst)) continue; // never overwrite anything already there
      await fs.cp(src, dst, { recursive: true, preserveTimestamps: true, errorOnExist: false, force: false });
      copied.push(item);
    }
  }
  await fs.writeFile(markerPath, JSON.stringify({ from: legacyDir, at: new Date().toISOString(), copied }, null, 2));
  if (copied.length) console.info(`[store] copied legacy data from ${legacyDir}: ${copied.join(", ")}`);
  return { copied, skipped: false };
}

/** Copy files into userData/backups/<timestamp>-<label>/ before a migration touches them. */
async function backupFiles(userData, files, label) {
  const present = [];
  for (const f of files) if (await exists(path.join(userData, f))) present.push(f);
  if (!present.length) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(userData, "backups", `${stamp}-${label}`);
  await fs.mkdir(dir, { recursive: true });
  for (const f of present) await fs.cp(path.join(userData, f), path.join(dir, f), { recursive: true });
  return dir;
}

module.exports = { configureUserData, copyLegacyUserData, backupFiles };
