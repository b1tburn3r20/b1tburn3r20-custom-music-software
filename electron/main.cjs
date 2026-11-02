const { app, BrowserWindow } = require("electron");
const path = require("path");
const { configureUserData, copyLegacyUserData } = require("./store/paths.cjs");
const { createLibraryStore } = require("./store/library.cjs");
const { createUserStore } = require("./store/user.cjs");
const { registerMediaScheme, handleMediaProtocol } = require("./media-protocol.cjs");
const { registerLibraryIpc, broadcast } = require("./ipc.cjs");
const { registerYoutubeIpc } = require("./youtube/ipc.cjs");
const { registerSyncHandlers } = require("../handlers/sysHandlers.cjs");

const isDev = !app.isPackaged && !process.env.B1T_LOAD_DIST;

// Must happen before "ready": pin the data folder and the media:// scheme.
const userData = configureUserData(app);
registerMediaScheme();

app.commandLine.appendSwitch("high-dpi-support", "true");
app.commandLine.appendSwitch("force-device-scale-factor", "1");

let stores = null;

async function initStores() {
  await copyLegacyUserData(app);
  const library = createLibraryStore({ userData, emit: (delta) => broadcast("library:changed", delta) });
  const libReport = await library.load();
  const user = createUserStore({ userData, library, emit: (snap) => broadcast("user:changed", snap) });
  const userReport = await user.load();
  stores = { library, user };
  registerLibraryIpc({ library, user, userData });
  registerYoutubeIpc({ library, user, userData });
  registerSyncHandlers();
  handleMediaProtocol(library);
  console.info("[main] stores ready", { userData, library: libReport, user: { migrated: userReport.migrated } });
  // Incremental rescan in the background: picks up files added/removed while the app was closed.
  if (library.rootDir) library.scan().catch((e) => console.error("[main] startup scan failed:", e.message));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    frame: false,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  win.webContents.setZoomFactor(1.0);
  if (isDev) win.loadURL("http://localhost:5173");
  else win.loadFile(path.join(__dirname, "../dist/index.html"));
}

app.whenReady().then(async () => {
  try {
    await initStores();
  } catch (err) {
    console.error("[main] failed to initialise data stores:", err);
    const { dialog } = require("electron");
    dialog.showErrorBox("b1tburn3r20 couldn't load your library", `${err.message}\n\nNothing was changed. Your data is in ${userData}.`);
    app.quit();
    return;
  }
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", async (e) => {
  if (!stores || stores.flushed) return;
  e.preventDefault();
  stores.flushed = true;
  await Promise.allSettled([stores.library.flush(), stores.user.flush()]);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
