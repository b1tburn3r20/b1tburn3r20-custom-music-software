const { app, safeStorage, shell } = require("electron");
const path = require("path");
const { handle, broadcast } = require("../ipc.cjs");
const { createYoutubeService, isMix } = require("./service.cjs");
const { createDownloadManager } = require("./downloads.cjs");
const { resetJsDiagnosis } = require("./ytdlp.cjs");
const { resolveTool, toolsDir, toolStatus } = require("../lib/tools.cjs");
const { createYtDlpUpdater } = require("../lib/ytdlpUpdate.cjs");
const { createCredentialStore } = require("./credentials.cjs");
const { createPublicApi } = require("./publicApi.cjs");
const { createGoogleAuth } = require("./oauth.cjs");
const { createAccountApi } = require("./accountApi.cjs");
const { createYoutubeAccountStore } = require("../store/youtubeAccount.cjs");
const { isExternalWebUrl } = require("../security.cjs");

/** For tests against a fake Google. Ignored in an installed app, so tokens can't be redirected. */
function testEndpoints() {
  if (app.isPackaged || !process.env.B1T_GOOGLE_ENDPOINTS) return undefined;
  return JSON.parse(process.env.B1T_GOOGLE_ENDPOINTS);
}

const FINISHED = new Set(["done", "error", "cancelled", "skipped"]);

async function registerYoutubeIpc({ library, user, userData }) {
  const youtube = createYoutubeService({ user, userData });
  const accountStore = createYoutubeAccountStore({ userData });
  const { purged } = await accountStore.load();
  if (purged) console.info("[youtube] removed YouTube data older than 30 days");

  /** A liked video becomes a local like once, whichever way the song arrived. */
  async function applyLike(videoId, songId) {
    if (!accountStore.get().liked.some((v) => v.id === videoId)) return;
    if ((await accountStore.takeUnappliedLikes([videoId])).length) user.setLiked(songId, true);
  }
  const downloads = createDownloadManager({ library, user, youtube, emit: (item) => broadcast("youtube:download-update", item), onSongReady: applyLike });

  const ytDlpUpdater = createYtDlpUpdater({
    resolve: () => resolveTool("yt-dlp"),
    toolsDir: toolsDir(),
    ...(testEndpoints() ? { fetchFn: () => Promise.reject(new Error("no real network in tests")) } : {}),
    isBusy: () => downloads.list().some((item) => !FINISHED.has(item.status)),
    onInstalled: resetJsDiagnosis,
    emit: (state) => broadcast("tools:ytdlp-state-changed", state),
  });
  const credentials = createCredentialStore({ dir: path.join(userData, "credentials"), safeStorage });
  const test = testEndpoints();
  const publicApi = createPublicApi({ getKey: () => credentials.get("apiKey"), ...(test ? { apiBase: test.api } : {}) });
  const google = createGoogleAuth({
    credentials,
    openExternal: (url) => {
      // Under test nobody is at a browser, so follow the fake sign-in page directly.
      if (test) return fetch(url).then(() => {});
      return isExternalWebUrl(url) ? shell.openExternal(url) : Promise.reject(new Error("Refusing to open that address."));
    },
    ...(test ? { endpoints: test } : {}),
    onChange: () => void accessChanged(),
  });
  const accountApi = createAccountApi({ authorizedFetch: (url) => google.authorizedFetch(url), ...(test ? { apiBase: test.api } : {}) });

  const publicAccount = () => {
    const { fetchedAt, channel, playlists, liked, subscriptions, dismissed } = accountStore.get();
    return { fetchedAt, channel, playlists, liked, subscriptions, dismissed };
  };
  const LIKED = { id: "LL", title: "Liked videos", system: true };

  youtube.useAccount({
    isConnected: async () => (await google.status()).connected,
    owns: (id) => id === LIKED.id || accountStore.get().playlists.some((p) => p.id === id),
    playlists: async () => {
      if (accountStore.isStale()) await syncAccount();
      const { liked, playlists } = accountStore.get();
      return [{ ...LIKED, count: liked.length, thumbnail: (liked[0] && liked[0].thumbnail) || null }, ...playlists];
    },
    playlistItems: async (id) => {
      if (id === LIKED.id) return { id, title: LIKED.title, channel: "", videos: await accountApi.likedVideos() };
      const known = accountStore.get().playlists.find((p) => p.id === id);
      return { id, title: known ? known.title : id, channel: "", videos: await accountApi.playlistItems(id) };
    },
  });

  /**
   * Refreshes what can be refreshed. One failing list (say, an exhausted quota) keeps what
   * was there before and is reported, rather than losing everything that did load.
   */
  async function syncAccount() {
    const results = await Promise.allSettled([accountApi.channel(), accountApi.playlists(), accountApi.likedVideos(), accountApi.subscriptions()]);
    const [channel, playlists, liked, subscriptions] = results;
    const patch = {};
    if (channel.status === "fulfilled") patch.channel = channel.value;
    if (playlists.status === "fulfilled") patch.playlists = playlists.value;
    if (liked.status === "fulfilled") patch.liked = liked.value;
    if (subscriptions.status === "fulfilled") patch.subscriptions = subscriptions.value;
    const failure = results.find((r) => r.status === "rejected");
    if (Object.keys(patch).length) await accountStore.update(patch);
    // A like for a song already in the library applies now, since it won't be downloaded.
    for (const video of accountStore.get().liked) {
      const song = library.visibleSongs().find((s) => s.sourceId === video.id);
      if (song) await applyLike(video.id, song.id);
    }
    broadcast("youtube:account-changed", publicAccount());
    await accessChanged();
    return { syncError: failure ? { code: failure.reason.code || "ERROR", message: failure.reason.message } : null };
  }

  /** Yes/no facts only. Secrets never cross into the renderer. */
  async function access() {
    const auth = await google.status();
    return {
      hasApiKey: await credentials.has("apiKey"),
      hasOAuthClient: auth.hasClient,
      connected: auth.connected,
      needsReconnect: auth.needsReconnect,
      channel: auth.connected ? accountStore.get().channel : null,
      cookieMode: youtube.authMode() !== "none",
      secureStorage: credentials.secureStorage(),
      unreadable: credentials.unreadable(),
    };
  }
  async function accessChanged() {
    const state = await access();
    broadcast("youtube:access-changed", state);
    return state;
  }
  const youtubeInUse = (state) => state.hasApiKey || state.connected || state.cookieMode;

  handle("youtube:access", access);
  handle("youtube:account", publicAccount);
  handle("youtube:set-client", async (input, opts = {}) => {
    const result = await google.setClient(input, { allowWeak: Boolean(opts.allowWeak) });
    await accessChanged();
    return result;
  });
  handle("youtube:connect", async (opts = {}) => {
    await google.connect({ allowWeak: Boolean(opts.allowWeak) });
    void ytDlpUpdater.check();
    return syncAccount();
  });
  handle("youtube:cancel-connect", () => google.cancelConnect());
  handle("youtube:refresh-account", syncAccount);
  handle("youtube:disconnect", async (opts = {}) => {
    const result = await google.disconnect();
    await accountStore.clear();
    if (opts.removeMirrors) {
      for (const p of user.snapshot().playlists) if (p.source && p.source.type === "youtube") user.deletePlaylist(p.id);
    }
    broadcast("youtube:account-changed", publicAccount());
    await accessChanged();
    return result;
  });
  handle("youtube:remove-client", async () => {
    const result = await google.removeClient();
    await accountStore.clear();
    broadcast("youtube:account-changed", publicAccount());
    await accessChanged();
    return result;
  });
  handle("youtube:dismiss-suggestion", async (id) => {
    await accountStore.dismiss(String(id));
    broadcast("youtube:account-changed", publicAccount());
    return null;
  });
  handle("youtube:set-api-key", async (candidate, opts = {}) => {
    const key = await publicApi.validateKey(candidate);
    const { persisted } = await credentials.set("apiKey", key, { allowWeak: Boolean(opts.allowWeak) });
    await accessChanged();
    void ytDlpUpdater.check(); // first use of YouTube, or a new key: make sure the downloader is ready
    return { persisted };
  });
  handle("youtube:remove-api-key", async () => {
    await credentials.remove("apiKey");
    await accessChanged();
    return null;
  });
  handle("youtube:video-details", (ids) => publicApi.videoDetails(Array.isArray(ids) ? ids.map(String) : []));
  handle("youtube:search-videos", (q, filters) => publicApi.searchVideos(q, filters));
  handle("youtube:search-playlists", (q, filters) => publicApi.searchPlaylists(q, filters));
  handle("youtube:public-playlist", (id) => publicApi.playlistWithVideos(id));
  // A pasted link is a request for one known thing, so it doesn't need search's API key.
  handle("youtube:lookup-link", async ({ videoId, playlistId } = {}) => {
    const hasKey = await credentials.has("apiKey");
    if (playlistId) {
      // The official API can't read mixes, key or no key.
      const playlist = hasKey && !isMix(playlistId) ? await publicApi.playlistWithVideos(playlistId) : await youtube.linkPlaylist(playlistId, videoId);
      return { playlists: [playlist] };
    }
    if (!videoId) throw Object.assign(new Error("That link doesn't point to a video or playlist."), { code: "BAD_INPUT" });
    return { videos: hasKey ? await publicApi.videoDetails([videoId]) : [await youtube.videoInfo(videoId)] };
  });

  handle("tools:status", () => toolStatus());
  handle("tools:ytdlp-state", () => ytDlpUpdater.getState());
  handle("tools:ytdlp-check", () => ytDlpUpdater.check());
  handle("tools:ytdlp-update", () => ytDlpUpdater.update());

  handle("youtube:auth-status", () => youtube.status());
  handle("youtube:set-auth", async (patch) => {
    const status = await youtube.setAuth(patch || {});
    await accessChanged();
    return status;
  });
  handle("youtube:import-cookies", async () => {
    const result = await youtube.importCookiesFile();
    await accessChanged();
    return result;
  });
  handle("youtube:remove-cookies", async () => {
    const status = await youtube.removeCookiesFile();
    await accessChanged();
    return status;
  });
  handle("youtube:check-auth", () => youtube.checkAuth());
  handle("youtube:my-playlists", () => youtube.myPlaylists());
  handle("youtube:playlist-items", (id) => youtube.playlistItems(id));
  handle("youtube:playlist-count", (id) => youtube.playlistCount(id));

  handle("youtube:enqueue", (videos, opts = {}) => {
    let target = null;
    if (opts.mirror && opts.mirror.youtubeId) target = user.ensureMirrorPlaylist(String(opts.mirror.youtubeId), String(opts.mirror.title || ""));
    else if (opts.playlistId) target = { id: String(opts.playlistId) };
    const mirror = Boolean(opts.mirror && opts.mirror.youtubeId);
    return { items: downloads.enqueue(videos || [], { target: target ? { id: target.id, mirror } : null }), playlistId: target ? target.id : null };
  });
  handle("youtube:downloads", () => downloads.list());
  handle("youtube:cancel", (videoId) => (videoId ? downloads.cancel(videoId) : downloads.cancelAll()));
  handle("youtube:clear-finished", () => downloads.clearFinished());
  // Single download that resolves when finished (used by search results).
  handle("youtube:download", async ({ videoId, title, channel, duration }) => {
    downloads.enqueue([{ videoId, title, channel, duration }]);
    const item = await downloads.waitFor(videoId);
    if (item.status === "error") throw Object.assign(new Error(item.error.message), { code: item.error.code });
    if (item.status === "cancelled") throw Object.assign(new Error("Download cancelled"), { code: "CANCELLED" });
    return { songId: item.songId, alreadyHad: item.status === "skipped" };
  });
  /** yt-dlp is only used for YouTube, so skip the check (a network call) while that's locked. */
  const checkToolsOnLaunch = async () => {
    const state = await access();
    if (youtubeInUse(state)) await ytDlpUpdater.check();
    if (state.connected && accountStore.isStale()) await syncAccount();
  };
  return { youtube, downloads, checkToolsOnLaunch, credentials };
}

module.exports = { registerYoutubeIpc };
