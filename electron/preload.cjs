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
    orphanReport: () => invoke("library:orphan-report"),
    orphanCleanup: (opts) => invoke("library:orphan-cleanup", opts),
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
    authStatus: () => invoke("youtube:auth-status"),
    setAuth: (patch) => invoke("youtube:set-auth", patch),
    importCookies: () => invoke("youtube:import-cookies"),
    removeCookies: () => invoke("youtube:remove-cookies"),
    checkAuth: () => invoke("youtube:check-auth"),
    myPlaylists: () => invoke("youtube:my-playlists"),
    playlistItems: (id) => invoke("youtube:playlist-items", id),
    enqueue: (videos, opts) => invoke("youtube:enqueue", videos, opts),
    downloads: () => invoke("youtube:downloads"),
    cancel: (videoId) => invoke("youtube:cancel", videoId),
    clearFinished: () => invoke("youtube:clear-finished"),
    download: (input) => invoke("youtube:download", input),
    onDownloadUpdate: on("youtube:download-update"),
  },
  stats: {
    recordPlay: (event) => invoke("stats:record-play", event),
    get: (range) => invoke("stats:get", range),
    history: (opts) => invoke("stats:history", opts),
    onChanged: on("stats:changed"),
  },
  sync: {
    toPhone: (data) => invoke("sync-to-phone", data),
    checkAdb: () => invoke("check-adb-connection"),
    onProgress: on("sync-progress"),
  },
});
