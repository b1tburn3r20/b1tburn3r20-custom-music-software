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
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('download-progress');
  },
  onDownloadComplete: (callback) => {
    ipcRenderer.on('download-complete', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('download-complete');
  }
});
