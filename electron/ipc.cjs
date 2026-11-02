// IPC surface for library + user data. Every handler returns
// { ok: true, data } or { ok: false, error: { code, message } } so the renderer
// never has to guess whether a call failed (previously many failures were
// silently treated as success).
const { ipcMain, dialog, shell, BrowserWindow } = require("electron");
const fs = require("fs").promises;
const path = require("path");

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      const data = await fn(...args, event);
      return { ok: true, data: data === undefined ? null : data };
    } catch (err) {
      const code = err.code && typeof err.code === "string" ? err.code : "ERROR";
      if (code === "ERROR") console.error(`[ipc] ${channel} failed:`, err);
      return { ok: false, error: { code, message: err.message || String(err) } };
    }
  });
}

class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

async function deleteAudioFile(filePath) {
  try {
    await shell.trashItem(filePath); // recoverable from the OS trash
    return "trash";
  } catch (trashErr) {
    try {
      await fs.unlink(filePath);
      return "unlink";
    } catch (err) {
      if (err.code === "ENOENT") return "already-gone";
      throw new AppError("DELETE_FAILED", `Couldn't delete the file: ${err.message} (trash: ${trashErr.message})`);
    }
  }
}

function registerLibraryIpc({ library, user, plays, userData }) {
  // ----- library -----
  handle("library:get", () => library.snapshot());
  handle("library:rescan", () => library.scan());
  handle("library:select-folder", async () => {
    const res = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (res.canceled || !res.filePaths[0]) return null;
    const summary = await library.scan(res.filePaths[0]);
    return { rootDir: res.filePaths[0], summary };
  });
  handle("library:delete-song", async (songId) => {
    const song = library.getSong(songId);
    if (!song) throw new AppError("SONG_NOT_FOUND", "That song is no longer in your library.");
    const how = await deleteAudioFile(song.path);
    await library.removeSong(songId);
    user.purgeSongs([songId]);
    if (plays) await plays.purgeSongs([songId]);
    return { deleted: songId, how };
  });
  handle("library:orphan-report", async () => {
    const lib = await library.orphanReport();
    const dangling = user.danglingReferences();
    const danglingCount = new Set([...dangling.playlists.flatMap((p) => p.songIds), ...dangling.likes, ...dangling.recentlyPlayed, ...dangling.recentlyDownloaded]).size;
    return { ...lib, danglingReferences: danglingCount };
  });
  handle("library:orphan-cleanup", async ({ thumbnails = false, dangling = false, missingIds = [] } = {}) => {
    const forgotten = missingIds.length ? await library.forgetMissing(missingIds) : [];
    const thumbsRemoved = thumbnails ? await library.removeOrphanThumbnails() : 0;
    // forgetting missing songs creates dangling references, so clean those afterwards
    const refsRemoved = dangling || forgotten.length ? user.removeDangling() : 0;
    if (plays && forgotten.length) await plays.purgeSongs(forgotten);
    return { thumbsRemoved, refsRemoved, forgotten: forgotten.length };
  });
  handle("library:show-in-folder", (songId) => {
    const song = library.getSong(songId);
    if (song) shell.showItemInFolder(song.path);
  });

  // ----- user data -----
  handle("user:get", () => user.snapshot());
  handle("user:set-liked", (songId, liked) => user.setLiked(songId, liked));
  handle("user:playlist-create", (input) => user.createPlaylist(input));
  handle("user:playlist-update", (id, patch) => user.updatePlaylist(id, patch));
  handle("user:playlist-delete", (id) => user.deletePlaylist(id));
  handle("user:playlist-add-songs", (id, songIds) => user.addSongs(id, songIds));
  handle("user:playlist-remove-song", (id, songId) => user.removeSongFromPlaylist(id, songId));
  handle("user:playlist-reorder", (id, songIds) => user.reorderPlaylist(id, songIds));
  handle("user:add-song-to-playlists", (songId, playlistIds) => user.addSongToPlaylists(songId, playlistIds));
  handle("user:record-recently-played", (songId) => user.recordRecentlyPlayed(songId));
  handle("user:record-recent-playlist", (id) => user.recordRecentPlaylist(id));
  handle("user:update-settings", (patch) => user.updateSettings(patch));
  handle("user:dismiss-notice", (id) => user.dismissNotice(id));
  handle("user:import-legacy", async (dump, origin) => {
    // Keep a raw copy of the old localStorage before anything is interpreted.
    const backupDir = path.join(userData, "backups");
    await fs.mkdir(backupDir, { recursive: true });
    const safeOrigin = String(origin).replace(/[^a-z0-9]+/gi, "_");
    const backupFile = path.join(backupDir, `localStorage-${safeOrigin}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await fs.writeFile(backupFile, JSON.stringify({ origin, dump }, null, 2));
    const report = user.importLegacy(dump, origin);
    // Old installs kept the music folder only in localStorage.
    if (!library.rootDir && dump && typeof dump.lastRootDir === "string" && dump.lastRootDir) {
      await library.scan(dump.lastRootDir).catch((e) => console.error("[ipc] scan of legacy root failed:", e.message));
    }
    return report;
  });
}

module.exports = { registerLibraryIpc, broadcast, handle, AppError };
