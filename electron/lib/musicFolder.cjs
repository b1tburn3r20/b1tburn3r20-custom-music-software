// The folder a new user's music lives in. Every OS already has one, so nobody has to
// choose a folder before they can start.
const fs = require("fs").promises;
const os = require("os");
const path = require("path");

/** Electron's answer respects redirected folders (OneDrive on Windows, XDG on Linux). */
function defaultMusicFolder(getPath, home = os.homedir()) {
  try {
    const dir = getPath("music");
    if (dir) return dir;
  } catch {
    /* some Linux setups define no music folder */
  }
  return path.join(home, "Music");
}

/**
 * Applies the default only if no folder is set yet: a folder the user chose, or one
 * restored by the legacy import, is never replaced. Never throws: the app must still
 * open, and the caller offers "Change folder" when this reports a failure.
 */
async function ensureDefaultFolder({ library, getPath, home }) {
  if (library.rootDir) return { applied: false, rootDir: library.rootDir };
  const rootDir = defaultMusicFolder(getPath, home);
  try {
    await fs.mkdir(rootDir, { recursive: true });
    const summary = await library.scan(rootDir);
    return { applied: true, rootDir, summary };
  } catch (err) {
    console.warn(`[library] couldn't use the default music folder: ${err.message}`);
    return { applied: false, rootDir: null, attempted: rootDir, error: err.message };
  }
}

module.exports = { defaultMusicFolder, ensureDefaultFolder };
