const { app, BrowserWindow } = require("electron");
const path = require("path");
const { registerFileSystemHandlers } = require('../handlers/fileSystemHandlers.cjs');
const { registerDownloadHandlers } = require('../handlers/downloadHandlers.cjs');
const { registerSyncHandlers } = require("../handlers/sysHandlers.cjs");
const { registerPlaylistHandlers } = require("../handlers/playlistHandlers.cjs")
const isDev = !app.isPackaged;

app.commandLine.appendSwitch('high-dpi-support', 'true');
app.commandLine.appendSwitch('force-device-scale-factor', '1');

function createWindow() {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    frame: false,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: false,
    },
  });
  win.webContents.setZoomFactor(1.0);

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  registerFileSystemHandlers();
  registerDownloadHandlers();
  registerSyncHandlers()
  registerPlaylistHandlers()
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
