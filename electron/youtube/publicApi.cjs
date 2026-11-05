// YouTube Data API v3 for public data (search and lookups), using the API key the user
// supplied. Runs in the main process so the key never reaches the renderer, and is sent
// in a header so it never appears in a URL or a log.
const { YtError } = require("./ytdlp.cjs");

const API = "https://www.googleapis.com/youtube/v3";
const TEST_VIDEO = "jNQXAC9IVRw";
const KEY_RE = /^[A-Za-z0-9_-]{20,100}$/;

/** ISO-8601 duration ("PT1H2M3S", "P1DT2H") → seconds. */
function parseISODuration(iso) {
  if (!iso) return 0;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso);
  if (!m) return 0;
  return Number(m[1] || 0) * 86400 + Number(m[2] || 0) * 3600 + Number(m[3] || 0) * 60 + Math.round(Number(m[4] || 0));
}

/** Turns Google's error body into something a person can act on. */
function classifyApiError(status, body) {
  const error = (body && body.error) || {};
  const reason = error.errors && error.errors[0] && error.errors[0].reason;
  const detail = ((error.details || []).find((d) => d && d.reason) || {}).reason;
  if (detail === "API_KEY_INVALID" || reason === "keyInvalid") return new YtError("API_KEY_INVALID", "Google says that API key isn't valid. Check you copied all of it, or create a new one.");
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") return new YtError("QUOTA_EXCEEDED", "Your YouTube search quota for today is used up (about 100 searches). It resets at midnight Pacific time.");
  if (reason === "accessNotConfigured" || detail === "SERVICE_DISABLED") return new YtError("API_NOT_ENABLED", "YouTube Data API v3 isn't turned on for this key's Google project. Enable it in Google Cloud Console, wait a minute, and try again.");
  if (detail === "API_KEY_SERVICE_BLOCKED" || detail === "API_KEY_HTTP_REFERRER_BLOCKED" || detail === "API_KEY_IP_ADDRESS_BLOCKED" || reason === "ipRefererBlocked") return new YtError("API_KEY_RESTRICTED", "This key's restrictions block YouTube. In Google Cloud Console, restrict it to the YouTube Data API v3 only, with no website or IP limits.");
  return new YtError("YOUTUBE_API_ERROR", error.message || `YouTube request failed (${status}).`);
}

const thumb = (t) => (t && ((t.high && t.high.url) || (t.medium && t.medium.url) || (t.default && t.default.url))) || null;
const toVideo = (v) => ({
  id: v.id,
  title: v.snippet.title,
  channel: v.snippet.channelTitle,
  duration: parseISODuration(v.contentDetails.duration),
  thumbnail: thumb(v.snippet.thumbnails),
  embeddable: v.status && v.status.embeddable,
});

function createPublicApi({ getKey, fetchFn = fetch, apiBase = API }) {
  async function request(apiPath, params, key) {
    let res;
    try {
      res = await fetchFn(`${apiBase}/${apiPath}?${new URLSearchParams(params)}`, { headers: { "X-Goog-Api-Key": key } });
    } catch {
      throw new YtError("NETWORK", "Couldn't reach YouTube. Check your internet connection.");
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) throw classifyApiError(res.status, body);
    return body;
  }

  async function get(apiPath, params) {
    const key = await getKey();
    if (!key) throw new YtError("API_KEY_MISSING", "Add a YouTube API key to search YouTube.");
    return request(apiPath, params, key);
  }

  async function videoDetails(ids) {
    const out = [];
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      if (!batch.length) continue;
      const data = await get("videos", { part: "snippet,contentDetails,status", id: batch.join(",") });
      out.push(...data.items.map(toVideo));
    }
    return out;
  }

  async function searchVideos(q, f = {}) {
    const params = { part: "snippet", q: String(q), type: "video", maxResults: "30", safeSearch: f.safeSearch ? "strict" : "none" };
    if (f.musicOnly) params.videoCategoryId = "10";
    const data = await get("search", params);
    const ids = data.items.map((i) => i.id.videoId).filter(Boolean);
    const byId = new Map((await videoDetails(ids)).map((d) => [d.id, d]));
    return ids.map((id) => byId.get(id)).filter(Boolean); // keep search order
  }

  async function playlistWithVideos(playlistId) {
    const meta = await get("playlists", { part: "snippet,contentDetails", id: String(playlistId) });
    const p = meta.items[0];
    if (!p) throw new YtError("PLAYLIST_UNAVAILABLE", "That playlist doesn't exist or is private. Your own private playlists are under “My playlists” once you've connected Google.");
    const ids = [];
    let pageToken;
    do {
      const page = await get("playlistItems", { part: "contentDetails", playlistId: String(playlistId), maxResults: "50", ...(pageToken ? { pageToken } : {}) });
      ids.push(...page.items.map((i) => i.contentDetails.videoId).filter(Boolean));
      pageToken = page.nextPageToken;
    } while (pageToken && ids.length < 2000);
    const byId = new Map((await videoDetails(ids)).map((d) => [d.id, d]));
    return {
      id: p.id,
      title: p.snippet.title,
      channel: p.snippet.channelTitle,
      thumbnail: thumb(p.snippet.thumbnails),
      count: p.contentDetails.itemCount,
      // ids missing from the details response are private or deleted
      videos: ids.map((id) => byId.get(id) || { id, title: "Unavailable video", channel: "", duration: 0, thumbnail: null, unavailable: true }),
    };
  }

  async function searchPlaylists(q, f = {}) {
    const data = await get("search", { part: "snippet", q: String(q), type: "playlist", maxResults: "15", safeSearch: f.safeSearch ? "strict" : "none" });
    const ids = data.items.map((i) => i.id.playlistId).filter(Boolean);
    const settled = await Promise.allSettled(ids.map(playlistWithVideos));
    return settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  }

  /** Tries a candidate key with the cheapest real call (1 quota unit), before it's saved. */
  async function validateKey(candidate) {
    const key = String(candidate || "").trim();
    if (!KEY_RE.test(key)) throw new YtError("API_KEY_INVALID", "That doesn't look like an API key. It should be one long string with no spaces.");
    await request("videos", { part: "id", id: TEST_VIDEO }, key);
    return key;
  }

  return { videoDetails, searchVideos, playlistWithVideos, searchPlaylists, validateKey };
}

module.exports = { createPublicApi, parseISODuration, classifyApiError };
