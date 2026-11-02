// Typed bridge exposed as window.api (see src/types/api.d.ts).
const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
const on = (channel) => (callback) => {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld("api", {
  library: {
    get: () => invoke("library:get"),
    rescan: () => invoke("library:rescan"),
    selectFolder: () => invoke("library:select-folder"),
    deleteSong: (songId) => invoke("library:delete-song", songId),
    showInFolder: (songId) => invoke("library:show-in-folder", songId),
    onChanged: on("library:changed"),
  },
  user: {
    get: () => invoke("user:get"),
    setLiked: (songId, liked) => invoke("user:set-liked", songId, liked),
    createPlaylist: (input) => invoke("user:playlist-create", input),
    updatePlaylist: (id, patch) => invoke("user:playlist-update", id, patch),
    deletePlaylist: (id) => invoke("user:playlist-delete", id),
    addSongsToPlaylist: (id, songIds) => invoke("user:playlist-add-songs", id, songIds),
    removeSongFromPlaylist: (id, songId) => invoke("user:playlist-remove-song", id, songId),
    reorderPlaylist: (id, songIds) => invoke("user:playlist-reorder", id, songIds),
    addSongToPlaylists: (songId, playlistIds) => invoke("user:add-song-to-playlists", songId, playlistIds),
    recordRecentlyPlayed: (songId) => invoke("user:record-recently-played", songId),
    recordRecentPlaylist: (id) => invoke("user:record-recent-playlist", id),
    updateSettings: (patch) => invoke("user:update-settings", patch),
    dismissNotice: (id) => invoke("user:dismiss-notice", id),
    importLegacy: (dump, origin) => invoke("user:import-legacy", dump, origin),
    onChanged: on("user:changed"),
  },
  youtube: {
    download: (input) => invoke("download-youtube", input),
    cancelAll: () => invoke("cancel-download"),
    onProgress: on("download-progress"),
    onComplete: on("download-complete"),
  },
  sync: {
    toPhone: (data) => invoke("sync-to-phone", data),
    checkAdb: () => invoke("check-adb-connection"),
    onProgress: on("sync-progress"),
  },
});
