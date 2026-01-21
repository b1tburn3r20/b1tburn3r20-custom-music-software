const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readFolder: (path) => ipcRenderer.invoke('read-folder', path),
  createFolder: (path) => ipcRenderer.invoke('create-folder', path),
  readFolderTree: (path) => ipcRenderer.invoke('read-folder-tree', path),
  readFolderDetails: (path) => ipcRenderer.invoke('read-folder-details', path),
  downloadYoutube: (data) => ipcRenderer.invoke('download-youtube', data),
  deleteSong: (path) => ipcRenderer.invoke('delete-file', path),
  deleteFolder: (path) => ipcRenderer.invoke('delete-folder', path),
  deleteFile: (path) => ipcRenderer.invoke('delete-file', path),

  // ADD THESE NEW HANDLERS
  searchSongs: (params) => ipcRenderer.invoke('search-songs', params),
  rebuildCache: (params) => ipcRenderer.invoke('rebuild-cache', params),
  getCacheStats: () => ipcRenderer.invoke('get-cache-stats'),
  getSongAudio: (filePath) => ipcRenderer.invoke('get-song-audio', filePath),

  onDownloadProgress: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('download-progress', handler)
    return () => ipcRenderer.removeListener('download-progress', handler)
  },
  onDownloadComplete: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('download-complete', handler)
    return () => ipcRenderer.removeListener('download-complete', handler)
  },
  syncToPhone: (data) => ipcRenderer.invoke('sync-to-phone', data),
  checkAdbConnection: () => ipcRenderer.invoke('check-adb-connection'),
  onSyncProgress: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('sync-progress', handler)
    return () => ipcRenderer.removeListener('sync-progress', handler)
  }
});
