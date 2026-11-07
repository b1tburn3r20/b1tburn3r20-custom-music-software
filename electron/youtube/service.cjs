// YouTube account features: sign-in settings, cookie-file import, listing the
// user's own playlists (including private ones and Liked videos).
const { dialog } = require("electron");
const fs = require("fs").promises;
const path = require("path");
const { authArgs, cookieFilePath, credentialsDir, detectBrowsers, runYtDlp, YtError, diagnoseJsChallenge, hasSignInCookies, youtubeCookiesOnly } = require("./ytdlp.cjs");

const PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{2,64}$/;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const UNAVAILABLE_TITLES = new Set(["[Private video]", "[Deleted video]", "[Unavailable video]"]);

function bestThumb(thumbnails) {
  if (!Array.isArray(thumbnails) || !thumbnails.length) return null;
  const sorted = [...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted[0].url || null;
}

/** yt-dlp's description of a video, in the shape the page uses. Previews need the embed flag, which yt-dlp doesn't report. */
function videoFromInfo(info) {
  return { id: info.id, title: info.title || info.id, channel: info.channel || info.uploader || "", duration: Number(info.duration) || 0, thumbnail: info.thumbnail || bestThumb(info.thumbnails) };
}

// A mix is a playlist YouTube generates around one video, and it goes on almost forever.
const MIX_SONG_LIMIT = 50;

/** RDCLAK lists are ordinary album playlists, despite starting with RD. */
const isMix = (playlistId) => /^RD/.test(String(playlistId)) && !/^RDCLAK/.test(String(playlistId));

/**
 * YouTube refuses to show a mix on the playlist page, so it has to be opened from its video.
 * Most mix ids are "RD" plus the video they're built around; the link usually says as well.
 */
function mixUrl(playlistId, videoId) {
  const video = videoId || (/^RD[A-Za-z0-9_-]{11}$/.test(playlistId) ? playlistId.slice(2) : null);
  if (!video || !VIDEO_ID_RE.test(video)) throw new YtError("PLAYLIST_UNAVAILABLE", "This link is to a YouTube mix, which can only be opened with its video. Copy the link from the page where the mix is playing.");
  return `https://www.youtube.com/watch?v=${video}&list=${playlistId}`;
}

function createYoutubeService({ user, userData }) {
  let lastCheck = null;
  let account = null;
  /** Set once Google sign-in exists. Downloads never use this: they don't depend on it surviving. */
  const useAccount = (source) => {
    account = source;
  };
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
      title: "Choose your cookies.txt (Netscape format)",
      properties: ["openFile"],
      filters: [{ name: "Cookies file", extensions: ["txt"] }, { name: "All files", extensions: ["*"] }],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    const src = res.filePaths[0];
    const stat = await fs.stat(src);
    if (stat.size > 5 * 1024 * 1024) throw new YtError("AUTH_INVALID", "That file is too large to be a cookies file.");
    // Validate the format only; contents are never logged or sent to the UI.
    const contents = await fs.readFile(src, "utf-8");
    const looksNetscape = /^# (Netscape )?HTTP Cookie File/m.test(contents) || contents.split("\n").some((l) => l.split("\t").length >= 7);
    if (!looksNetscape) throw new YtError("AUTH_INVALID", "That isn't a Netscape-format cookies file. In the extension, choose the Netscape format (not JSON) and export again.");
    if (!/(^|\t|\.)youtube\.com\t/m.test(contents)) throw new YtError("AUTH_INVALID", "That file has no YouTube cookies. Export it while you're signed in to YouTube, on a YouTube page.");
    if (!hasSignInCookies(contents)) throw new YtError("AUTH_INVALID", "That file was exported while signed out of YouTube, so it can't load your account. In a private window, sign in to YouTube first, then export again from that same tab.");
    await fs.mkdir(credentialsDir(userData), { recursive: true, mode: 0o700 });
    await fs.chmod(credentialsDir(userData), 0o700);
    const dst = cookieFilePath(userData);
    await fs.writeFile(dst, youtubeCookiesOnly(contents), { mode: 0o600 });
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

  /** With Google connected, the official API. Otherwise, cookies if those are set up. */
  async function myPlaylists() {
    if (account && (await account.isConnected())) return account.playlists();
    return cookiePlaylists();
  }

  async function cookiePlaylists() {
    if (auth().mode === "none") throw new YtError("NOT_CONNECTED", "Connect Google to load your YouTube data.");
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

  function playlistFromInfo(data, playlistId) {
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

  async function playlistItems(playlistId) {
    if (!PLAYLIST_ID_RE.test(String(playlistId))) throw new YtError("BAD_INPUT", "Invalid playlist id.");
    // Only the user's own lists go through their quota; yt-dlp handles anything else.
    if (account && (await account.isConnected()) && account.owns(playlistId)) return account.playlistItems(playlistId);
    const { stdout } = await runYtDlp([...args(), "--flat-playlist", "-J", "--no-warnings", `https://www.youtube.com/playlist?list=${playlistId}`], { authMode: auth().mode });
    return playlistFromInfo(JSON.parse(stdout), playlistId);
  }

  /** How many videos a playlist has, read from its page without listing them. The feed of playlists often leaves this out. */
  async function playlistCount(playlistId) {
    if (!PLAYLIST_ID_RE.test(String(playlistId))) throw new YtError("BAD_INPUT", "Invalid playlist id.");
    const { stdout } = await runYtDlp([...args(), "--flat-playlist", "-J", "--no-warnings", "--playlist-items", "0", `https://www.youtube.com/playlist?list=${playlistId}`], { authMode: auth().mode });
    const count = JSON.parse(stdout).playlist_count;
    return Number.isInteger(count) ? count : null;
  }

  /** One video's details, from a pasted link. */
  async function videoInfo(videoId) {
    if (!VIDEO_ID_RE.test(String(videoId))) throw new YtError("BAD_INPUT", "That isn't a valid video link.");
    const { stdout } = await runYtDlp([...args(), "-J", "--no-warnings", "--no-playlist", "--ignore-no-formats-error", `https://www.youtube.com/watch?v=${videoId}`], { authMode: auth().mode });
    return videoFromInfo(JSON.parse(stdout));
  }

  /** A playlist from a pasted link, shaped like a search result. */
  async function linkPlaylist(playlistId, videoId) {
    if (!PLAYLIST_ID_RE.test(String(playlistId))) throw new YtError("BAD_INPUT", "That isn't a valid playlist link.");
    let result;
    if (isMix(playlistId)) {
      const { stdout } = await runYtDlp([...args(), "--flat-playlist", "-J", "--no-warnings", "--playlist-end", String(MIX_SONG_LIMIT), mixUrl(playlistId, videoId)], { authMode: auth().mode });
      result = playlistFromInfo(JSON.parse(stdout), playlistId);
    } else {
      result = await playlistItems(playlistId);
    }
    const { id, title, channel, videos } = result;
    return { id, title, channel, videos, count: videos.length, thumbnail: videos.find((v) => v.thumbnail)?.thumbnail ?? null };
  }

  async function checkAuth() {
    try {
      const pls = await cookiePlaylists(); // this checks the cookies, so it must not use Google sign-in
      // Listing playlists works without solving YouTube's JS challenge; downloading doesn't. Check that too.
      const diag = await diagnoseJsChallenge("jNQXAC9IVRw", args());
      return { ok: true, playlists: pls.length, downloadIssue: diag ? diag.message : null };
    } catch (err) {
      lastCheck = { ok: false, at: Date.now(), code: err.code || "ERROR", message: err.message };
      return lastCheck;
    }
  }

  return { videoInfo, linkPlaylist, useAccount, status, setAuth, importCookiesFile, removeCookiesFile, myPlaylists, playlistItems, playlistCount, checkAuth, authArgs: args, authMode: () => auth().mode };
}

module.exports = { createYoutubeService, videoFromInfo, isMix, mixUrl, MIX_SONG_LIMIT };
