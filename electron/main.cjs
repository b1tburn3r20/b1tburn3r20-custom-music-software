const { app, BrowserWindow, Menu, nativeImage, screen } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const { windowIconFiles } = require("./lib/appIcon.cjs");
const { hardenWindow, identifyToYoutubeEmbeds, setTrustedPage } = require("./security.cjs");
const { isSmokeTest, isolateUserData, musicDirOf, runSmokeTest, reportSmokeResult, watchForPolicyViolations } = require("./smoke.cjs");
const { configureUserData, copyLegacyUserData } = require("./store/paths.cjs");
const { createLibraryStore } = require("./store/library.cjs");
const { createUserStore } = require("./store/user.cjs");
const { createPlaysStore } = require("./store/plays.cjs");
const { createPositionsStore } = require("./store/positions.cjs");
const { splitArtists } = require("./lib/artists.cjs");
const { registerMediaScheme, handleMediaProtocol } = require("./media-protocol.cjs");
const { registerLibraryIpc, registerStatsIpc, broadcast, handle } = require("./ipc.cjs");
const { registerAiIpc } = require("./ai/ipc.cjs");
const { registerYoutubeIpc } = require("./youtube/ipc.cjs");
const { registerSyncHandlers } = require("../handlers/sysHandlers.cjs");

const smokeTest = isSmokeTest();
const smokeDir = smokeTest ? isolateUserData() : null;
const isDev = !app.isPackaged && !process.env.B1T_LOAD_DIST && !smokeTest;
const APP_ID = "com.b1tburn3r20.app";
const DEV_URL = "http://localhost:5173/";
const INDEX_FILE = path.join(__dirname, "../dist/index.html");
setTrustedPage(isDev ? DEV_URL : pathToFileURL(INDEX_FILE).href);

// Must happen before "ready": pin the data folder and the media:// scheme.
const userData = configureUserData(app);
if (smokeTest) app.setPath("music", musicDirOf(smokeDir));
else if (!app.isPackaged && process.env.B1T_MUSIC_DIR) app.setPath("music", process.env.B1T_MUSIC_DIR);
registerMediaScheme();

// Two running copies would overwrite each other's data files. The lock is per data folder.
const isPrimaryInstance = app.requestSingleInstanceLock();
if (!isPrimaryInstance) app.exit(0);

app.commandLine.appendSwitch("high-dpi-support", "true");
// Linux only: the UI is tuned for this on a tiling window manager. Forcing it on Windows
// or macOS would override the user's display scaling and blur or shrink the whole app.
if (process.platform === "linux") app.commandLine.appendSwitch("force-device-scale-factor", "1");

let stores = null;
let mainWindow = null;
let checkToolsOnLaunch = async () => {};

async function initStores() {
  await copyLegacyUserData(app);
  const library = createLibraryStore({
    userData,
    emit: (delta) => {
      broadcast("library:changed", delta);
      stores?.plays?.invalidate(); // artist attribution / deleted songs affect stats
    },
  });
  const libReport = await library.load();
  const user = createUserStore({ userData, library, emit: (snap) => broadcast("user:changed", snap) });
  const userReport = await user.load();
  const plays = createPlaysStore({
    userData,
    songInfo: (id) => {
      const s = library.getSong(id);
      if (!s || s.missing || !s.metadata) return null;
      return { artists: s.metadata.artists && s.metadata.artists.length ? s.metadata.artists : splitArtists(s.metadata.artist) };
    },
  });
  const playsReport = await plays.load();
  const positions = createPositionsStore({ userData });
  await positions.load();
  stores = { library, user, plays, positions };
  registerLibraryIpc({ library, user, plays, positions, userData });
  registerStatsIpc({ plays });
  const youtubeIpc = await registerYoutubeIpc({ library, user, userData });
  checkToolsOnLaunch = youtubeIpc.checkToolsOnLaunch;
  registerAiIpc({ library, user, credentials: youtubeIpc.credentials });
  const senderWindow = (event) => BrowserWindow.fromWebContents(event.sender);
  handle("window:is-fullscreen", (event) => senderWindow(event).isFullScreen());
  handle("window:set-title-bar-colors", (color, symbolColor, event) => {
    const hex = /^#[0-9a-f]{6}$/i;
    if (process.platform !== "win32" || !hex.test(color) || !hex.test(symbolColor)) return false;
    senderWindow(event).setTitleBarOverlay({ color, symbolColor, height: TITLE_BAR_HEIGHT });
    return true;
  });
  handle("window:toggle-fullscreen", (event) => {
    const win = senderWindow(event);
    win.setFullScreen(!win.isFullScreen());
    return null;
  });
  registerSyncHandlers();
  handleMediaProtocol(library);
  console.info("[main] stores ready", { userData, library: libReport, user: { migrated: userReport.migrated }, plays: playsReport });
  // Fix playlist entries an earlier build added by a title-only match, where the right song is already here.
  for (const [sourceId, wrongId] of library.clearedEntries()) {
    const right = library.visibleSongs().find((s) => s.sourceId === sourceId);
    if (!right) continue; // corrected later, when that video is downloaded
    const n = user.replaceInMirrorPlaylists(wrongId, right.id, sourceId);
    library.resolveCleared(sourceId);
    if (n) console.info(`[main] replaced a wrongly matched song in ${n} mirrored playlist(s) (${sourceId})`);
  }
  // Incremental rescan in the background: picks up files added/removed while the app was closed.
  if (library.rootDir) library.scan().catch((e) => console.error("[main] startup scan failed:", e.message));
}

/** Keep the default menu's reload and devtools in development; ship only what each OS needs. */
function configureMenu() {
  if (isDev) return;
  if (process.platform === "darwin") {
    // macOS routes copy, paste and quit through the menu bar, so it can't simply be removed.
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { label: "View", submenu: [{ role: "togglefullscreen" }] }, { role: "windowMenu" }]));
  } else {
    Menu.setApplicationMenu(null);
  }
}

/** The first usable icon the user supplied. Without one, Electron shows its default. */
function windowIcon() {
  const dir = path.join(__dirname, isDev ? "../public" : "../dist");
  for (const file of windowIconFiles()) {
    const image = nativeImage.createFromPath(path.join(dir, file));
    if (!image.isEmpty()) return image;
  }
  return null;
}

// Matches the bar's height in src/app/TitleBar.tsx.
const TITLE_BAR_HEIGHT = 32;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const icon = windowIcon();
  const win = new BrowserWindow({
    ...(icon ? { icon } : {}),
    width: Math.min(1920, width),
    height: Math.min(1080, height),
    // The custom frameless look has no drag areas or window buttons, which only works
    // under a window manager. Windows and macOS need the native title bar to move or close it.
    frame: process.platform !== "linux",
    // On Windows the page draws the bar, and only the three buttons stay native. TitleBar colors them.
    ...(process.platform === "win32" ? { titleBarStyle: "hidden", titleBarOverlay: { color: "#0a0a0a", symbolColor: "#f5f5f5", height: TITLE_BAR_HEIGHT } } : {}),
    resizable: true,
    show: !smokeTest,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  win.webContents.setZoomFactor(1.0);
  // Development keeps its menu for the reload and devtools shortcuts, but never shows it.
  if (process.platform !== "darwin") win.setMenuBarVisibility(false);
  hardenWindow(win);
  win.on("enter-full-screen", () => broadcast("window:fullscreen-changed", true));
  win.on("leave-full-screen", () => broadcast("window:fullscreen-changed", false));
  // Removing the menu also removed the shortcut it provided. macOS has its own, in the menu above.
  if (process.platform !== "darwin") {
    win.webContents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown" || input.key !== "F11") return;
      event.preventDefault();
      if (!input.isAutoRepeat) win.setFullScreen(!win.isFullScreen());
    });
  }
  identifyToYoutubeEmbeds(win.webContents.session, APP_ID);
  if (smokeTest) watchForPolicyViolations(win);
  if (isDev) win.loadURL(DEV_URL);
  else win.loadFile(INDEX_FILE);
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });
  mainWindow = win;
  return win;
}

async function finishSmokeTest(win) {
  const result = await runSmokeTest({ win, dir: smokeDir });
  const icon = windowIcon();
  reportSmokeResult({ ...result, windowIcon: icon ? icon.getSize() : null });
  await Promise.allSettled([stores.library.flush(), stores.user.flush(), stores.positions.flush()]);
  // Exit directly so the exit code is always the real result. Chromium keeps the data
  // folder open until the process ends, so whoever started this run cleans up (B1T_SMOKE_TMP).
  app.exit(result.ok ? 0 : 1);
}

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  if (!isPrimaryInstance) return;
  configureMenu();
  try {
    await initStores();
  } catch (err) {
    console.error("[main] failed to initialise data stores:", err);
    if (smokeTest) {
      reportSmokeResult({ ok: false, checks: { stores: String(err.message || err) } });
      app.exit(1);
      return;
    }
    const { dialog } = require("electron");
    dialog.showErrorBox("b1tburn3r20 couldn't load your library", `${err.message}\n\nNothing was changed. Your data is in ${userData}.`);
    app.quit();
    return;
  }
  const win = createWindow();
  if (smokeTest) {
    finishSmokeTest(win);
    return;
  }
  // In the background, once there's a window to tell about it: startup never waits on the network.
  win.webContents.once("did-finish-load", () => checkToolsOnLaunch().catch((e) => console.warn("[main] tool check failed:", e.message)));
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", async (e) => {
  if (!stores || stores.flushed) return;
  e.preventDefault();
  stores.flushed = true;
  await Promise.allSettled([stores.library.flush(), stores.user.flush(), stores.positions.flush()]);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
