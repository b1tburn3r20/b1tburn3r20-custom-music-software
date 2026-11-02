// YouTube account features: sign-in settings, cookie-file import, listing the
// user's own playlists (including private ones and Liked videos).
const { dialog } = require("electron");
const fs = require("fs").promises;
const path = require("path");
const { authArgs, cookieFilePath, credentialsDir, detectBrowsers, runYtDlp, YtError } = require("./ytdlp.cjs");

const PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{2,64}$/;
const UNAVAILABLE_TITLES = new Set(["[Private video]", "[Deleted video]", "[Unavailable video]"]);

function bestThumb(thumbnails) {
  if (!Array.isArray(thumbnails) || !thumbnails.length) return null;
  const sorted = [...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted[0].url || null;
}

function createYoutubeService({ user, userData }) {
  let lastCheck = null;
  const auth = () => user.settings.youtubeAuth || { mode: "none" };
  const args = () => authArgs(auth(), userData);

  async function status() {
    let hasCookieFile = false;
    try {
      await fs.access(cookieFilePath(userData));
      hasCookieFile = true;
    } catch {
      /* not imported */
    }
    const a = auth();
    return { mode: a.mode, browser: a.browser, profile: a.profile || "", hasCookieFile, browsers: detectBrowsers(), lastCheck };
  }

  function setAuth(patch) {
    const allowed = {};
    if (patch.mode && ["none", "browser", "file"].includes(patch.mode)) allowed.mode = patch.mode;
    if (typeof patch.browser === "string") allowed.browser = patch.browser;
    if (typeof patch.profile === "string") allowed.profile = patch.profile.slice(0, 100);
    user.updateSettings({ youtubeAuth: allowed });
    lastCheck = null;
    return status();
  }

  /** Pick an exported cookies.txt and keep a private copy (0600) in the app's data folder. */
  async function importCookiesFile() {
    const res = await dialog.showOpenDialog({
      title: "Import YouTube cookies (cookies.txt)",
      properties: ["openFile"],
      filters: [{ name: "Cookies file", extensions: ["txt"] }, { name: "All files", extensions: ["*"] }],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    const src = res.filePaths[0];
    const stat = await fs.stat(src);
    if (stat.size > 5 * 1024 * 1024) throw new YtError("AUTH_INVALID", "That file is too large to be a cookies file.");
    // Validate the format only; contents are never logged or sent to the UI.
    const head = (await fs.readFile(src, "utf-8")).slice(0, 200000);
    const looksNetscape = /^# (Netscape )?HTTP Cookie File/m.test(head) || head.split("\n").some((l) => l.split("\t").length >= 7);
    if (!looksNetscape) throw new YtError("AUTH_INVALID", "That doesn't look like a Netscape-format cookies.txt file.");
    if (!/(^|\t|\.)youtube\.com\t/m.test(head)) throw new YtError("AUTH_INVALID", "The file doesn't contain any youtube.com cookies. Export it while signed in to youtube.com.");
    await fs.mkdir(credentialsDir(userData), { recursive: true, mode: 0o700 });
    await fs.chmod(credentialsDir(userData), 0o700);
    const dst = cookieFilePath(userData);
    await fs.copyFile(src, dst);
    await fs.chmod(dst, 0o600);
    user.updateSettings({ youtubeAuth: { mode: "file" } });
    lastCheck = null;
    return { imported: path.basename(src) };
  }

  async function removeCookiesFile() {
    await fs.unlink(cookieFilePath(userData)).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
    if (auth().mode === "file") user.updateSettings({ youtubeAuth: { mode: "none" } });
    lastCheck = null;
    return status();
  }

  async function myPlaylists() {
    if (auth().mode === "none") throw new YtError("SIGN_IN_REQUIRED", "Sign in to YouTube in Settings → YouTube to see your own playlists.");
    const { stdout } = await runYtDlp([...args(), "--flat-playlist", "-J", "--no-warnings", "https://www.youtube.com/feed/playlists"], { authMode: auth().mode });
    const data = JSON.parse(stdout);
    const entries = (data.entries || [])
      .map((e) => ({ id: e.id || (e.url && new URL(e.url).searchParams.get("list")), title: e.title || "Untitled playlist", count: e.playlist_count ?? null, thumbnail: bestThumb(e.thumbnails) }))
      .filter((e) => e.id && PLAYLIST_ID_RE.test(e.id));
    // Private system playlists that the feed doesn't list.
    if (!entries.some((e) => e.id === "LL")) entries.unshift({ id: "LL", title: "Liked videos", count: null, thumbnail: null, system: true });
    lastCheck = { ok: true, at: Date.now(), playlists: entries.length };
    return entries;
  }

  async function playlistItems(playlistId) {
    if (!PLAYLIST_ID_RE.test(String(playlistId))) throw new YtError("BAD_INPUT", "Invalid playlist id.");
    const { stdout } = await runYtDlp([...args(), "--flat-playlist", "-J", "--no-warnings", `https://www.youtube.com/playlist?list=${playlistId}`], { authMode: auth().mode });
    const data = JSON.parse(stdout);
    return {
      id: playlistId,
      title: data.title || playlistId,
      channel: data.channel || data.uploader || "",
      videos: (data.entries || [])
        .filter((e) => e && e.id)
        .map((e) => ({
          id: e.id,
          title: e.title || e.id,
          channel: e.channel || e.uploader || "",
          duration: Number(e.duration) || 0,
          thumbnail: bestThumb(e.thumbnails),
          unavailable: UNAVAILABLE_TITLES.has(e.title) || e.availability === "private",
        })),
    };
  }

  async function checkAuth() {
    try {
      const pls = await myPlaylists();
      return { ok: true, playlists: pls.length };
    } catch (err) {
      lastCheck = { ok: false, at: Date.now(), code: err.code || "ERROR", message: err.message };
      return lastCheck;
    }
  }

  return { status, setAuth, importCookiesFile, removeCookiesFile, myPlaylists, playlistItems, checkAuth, authArgs: args, authMode: () => auth().mode };
}

module.exports = { createYoutubeService };
