// Reads the signed-in user's own YouTube data through the official API: playlists, liked
// videos and subscriptions. Read-only. Every list call costs 1 quota unit per page.
const { YtError } = require("./ytdlp.cjs");
const { parseISODuration } = require("./publicApi.cjs");

const API = "https://www.googleapis.com/youtube/v3";
const MUSIC_CATEGORY = "10";
// YouTube caps myRating lists at 1000, and this keeps one huge playlist from using up the quota.
const MAX_ITEMS = 2000;

function classify(status, body) {
  const error = (body && body.error) || {};
  const reason = error.errors && error.errors[0] && error.errors[0].reason;
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") return new YtError("QUOTA_EXCEEDED", "Your YouTube quota for today is used up. It resets at midnight Pacific time. What's already loaded stays available.");
  if (reason === "insufficientPermissions" || status === 401) return new YtError("NEEDS_RECONNECT", "YouTube needs you to connect again, and to leave the YouTube permission ticked.");
  if (reason === "accessNotConfigured") return new YtError("API_NOT_ENABLED", "YouTube Data API v3 isn't turned on for your Google project. Enable it in Google Cloud Console, wait a minute, and try again.");
  if (reason === "channelNotFound" || reason === "youtubeSignupRequired") return new YtError("NO_CHANNEL", "This Google account has no YouTube channel yet, so there's nothing to load. Create one on youtube.com, or connect a different account.");
  if (reason === "playlistNotFound") return new YtError("PLAYLIST_UNAVAILABLE", "That playlist isn't available any more.");
  return new YtError("YOUTUBE_API_ERROR", error.message || `YouTube request failed (${status}).`);
}

const bestThumb = (t) => (t && ((t.high && t.high.url) || (t.medium && t.medium.url) || (t.default && t.default.url))) || null;

const toVideo = (v) => ({
  id: v.id,
  title: v.snippet.title,
  channel: v.snippet.channelTitle, // the video's own channel, unlike a playlist item's channelTitle
  duration: parseISODuration(v.contentDetails && v.contentDetails.duration),
  thumbnail: bestThumb(v.snippet.thumbnails),
  embeddable: v.status && v.status.embeddable,
  isMusic: v.snippet.categoryId === MUSIC_CATEGORY,
});

function createAccountApi({ authorizedFetch, apiBase = API }) {
  async function get(apiPath, params) {
    const res = await authorizedFetch(`${apiBase}/${apiPath}?${new URLSearchParams(params)}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) throw classify(res.status, body);
    return body;
  }

  async function allPages(apiPath, params) {
    const items = [];
    let pageToken;
    do {
      const page = await get(apiPath, { ...params, maxResults: "50", ...(pageToken ? { pageToken } : {}) });
      items.push(...(page.items || []));
      pageToken = page.nextPageToken;
    } while (pageToken && items.length < MAX_ITEMS);
    return items;
  }

  /** Who's connected. An account with no channel can be signed in, but has no data. */
  async function channel() {
    const { items } = await get("channels", { part: "snippet", mine: "true" });
    const c = items && items[0];
    if (!c) throw new YtError("NO_CHANNEL", "This Google account has no YouTube channel yet, so there's nothing to load. Create one on youtube.com, or connect a different account.");
    return { id: c.id, title: c.snippet.title, thumbnail: bestThumb(c.snippet.thumbnails) };
  }

  async function playlists() {
    const items = await allPages("playlists", { part: "snippet,contentDetails", mine: "true" });
    return items.map((p) => ({ id: p.id, title: p.snippet.title, count: p.contentDetails ? p.contentDetails.itemCount : null, thumbnail: bestThumb(p.snippet.thumbnails) }));
  }

  /** LL isn't readable as a normal playlist through the API, so likes use their own list. */
  async function likedVideos() {
    const items = await allPages("videos", { part: "snippet,contentDetails,status", myRating: "like" });
    return items.map(toVideo);
  }

  async function subscriptions() {
    const items = await allPages("subscriptions", { part: "snippet", mine: "true", order: "alphabetical" });
    return items
      .filter((s) => s.snippet && s.snippet.resourceId && s.snippet.resourceId.channelId)
      .map((s) => ({ channelId: s.snippet.resourceId.channelId, title: s.snippet.title, thumbnail: bestThumb(s.snippet.thumbnails) }));
  }

  async function videosById(ids) {
    const out = [];
    for (let i = 0; i < ids.length; i += 50) {
      const { items } = await get("videos", { part: "snippet,contentDetails,status", id: ids.slice(i, i + 50).join(",") });
      out.push(...(items || []).map(toVideo));
    }
    return out;
  }

  /** Same shape as the rest of the app's playlists, so mirrors and downloads work unchanged. */
  async function playlistItems(playlistId) {
    const items = await allPages("playlistItems", { part: "snippet,contentDetails", playlistId });
    const ids = items.map((i) => i.contentDetails && i.contentDetails.videoId).filter(Boolean);
    const byId = new Map((await videosById(ids)).map((v) => [v.id, v]));
    return ids.map((id) => byId.get(id) || { id, title: "Unavailable video", channel: "", duration: 0, thumbnail: null, unavailable: true });
  }

  return { channel, playlists, likedVideos, subscriptions, playlistItems };
}

module.exports = { createAccountApi, classify };
