const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readFolder: (path) => ipcRenderer.invoke('read-folder', path),
  getAllSongs: (params) => ipcRenderer.invoke('get-all-songs', params),
  searchSongs: (params) => ipcRenderer.invoke('search-songs', params),
  getSongAudio: (filePath) => ipcRenderer.invoke('get-song-audio', filePath),
  deleteSong: (path) => ipcRenderer.invoke('delete-file', path),
  deleteFile: (path) => ipcRenderer.invoke('delete-file', path),

  rebuildCache: (params) => ipcRenderer.invoke('rebuild-cache', params),
  getCacheStats: () => ipcRenderer.invoke('get-cache-stats'),
  addSongToCache: (params) => ipcRenderer.invoke('add-song-to-cache', params),
  updateSongInCache: (params) => ipcRenderer.invoke('update-song-in-cache', params),
  downloadYoutube: (data) => ipcRenderer.invoke('download-youtube', data),
  onDownloadProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('download-progress', handler);
    return () => ipcRenderer.removeListener('download-progress', handler);
  },
  onDownloadComplete: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('download-complete', handler);
    return () => ipcRenderer.removeListener('download-complete', handler);
  },
  onSongDeleted: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('song-deleted', handler);
    return () => ipcRenderer.removeListener('song-deleted', handler);
  },
  syncToPhone: (data) => ipcRenderer.invoke('sync-to-phone', data),
  checkAdbConnection: () => ipcRenderer.invoke('check-adb-connection'),
  onSyncProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('sync-progress', handler);
    return () => ipcRenderer.removeListener('sync-progress', handler);
  },

  cancelDownload: () => ipcRenderer.invoke('cancel-download'),
  getPlaylists: (options) => ipcRenderer.invoke('get-playlists', options),
  getSongCache: (options) => ipcRenderer.invoke('get-song-cache', options),
  getSongQueue: (options) => ipcRenderer.invoke('get-song-queue', options),
  getSongByPath: (options) => ipcRenderer.invoke('get-song-by-path', options),
  createPlaylist: (name, description) => ipcRenderer.invoke('create-playlist', { name, description }),
  updatePlaylist: (playlistId, updates) => ipcRenderer.invoke('update-playlist', { playlistId, ...updates }),
  deletePlaylist: (playlistId) => ipcRenderer.invoke('delete-playlist', { playlistId }),
  addSongToPlaylist: (playlistId, songPath) => ipcRenderer.invoke('add-song-to-playlist', { playlistId, songPath }),
  removeSongFromPlaylist: (playlistId, songPath) => ipcRenderer.invoke('remove-song-from-playlist', { playlistId, songPath }),
});
