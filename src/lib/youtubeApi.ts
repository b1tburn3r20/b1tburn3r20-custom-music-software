// YouTube Data API v3 (public search). Previously copy-pasted in three components.
// Signed-in features (your own/private playlists) go through yt-dlp in the main
// process instead — see electron/youtube/.
const API = "https://www.googleapis.com/youtube/v3"
const KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined

export type YtVideo = { id: string; title: string; channel: string; duration: number; thumbnail: string | null; embeddable?: boolean; unavailable?: boolean }
export type YtPlaylist = { id: string; title: string; channel: string; thumbnail: string | null; count: number | null; videos: YtVideo[] }

/** ISO-8601 duration ("PT1H2M3S", "P1DT2H") → seconds. The old parser ignored hours and days. */
export function parseISODuration(iso: string | undefined | null): number {
  if (!iso) return 0
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso)
  if (!m) return 0
  return Number(m[1] || 0) * 86400 + Number(m[2] || 0) * 3600 + Number(m[3] || 0) * 60 + Math.round(Number(m[4] || 0))
}

export class YoutubeApiError extends Error {}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!KEY) throw new YoutubeApiError("YouTube search isn't configured (missing VITE_YOUTUBE_API_KEY in .env).")
  const qs = new URLSearchParams({ ...params, key: KEY })
  let res: Response
  try {
    res = await fetch(`${API}/${path}?${qs}`)
  } catch {
    throw new YoutubeApiError("Couldn't reach YouTube. Check your internet connection.")
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    const reason = data.error?.errors?.[0]?.reason as string | undefined
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") throw new YoutubeApiError("The YouTube search quota for today is used up. Try again tomorrow, or paste a video/playlist link instead.")
    if (reason === "keyInvalid") throw new YoutubeApiError("The YouTube API key in .env is invalid.")
    throw new YoutubeApiError(data.error?.message || `YouTube request failed (${res.status}).`)
  }
  return data as T
}

type ApiVideo = { id: string; snippet: { title: string; channelTitle: string; thumbnails?: Record<string, { url: string }> }; contentDetails: { duration: string }; status?: { embeddable?: boolean } }
const thumb = (t?: Record<string, { url: string }>) => t?.high?.url ?? t?.medium?.url ?? t?.default?.url ?? null
const toVideo = (v: ApiVideo): YtVideo => ({
  id: v.id,
  title: v.snippet.title,
  channel: v.snippet.channelTitle,
  duration: parseISODuration(v.contentDetails.duration),
  thumbnail: thumb(v.snippet.thumbnails),
  embeddable: v.status?.embeddable,
})

export async function videoDetails(ids: string[]): Promise<YtVideo[]> {
  const out: YtVideo[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50)
    if (!batch.length) continue
    const data = await get<{ items: ApiVideo[] }>("videos", { part: "snippet,contentDetails,status", id: batch.join(",") })
    out.push(...data.items.map(toVideo))
  }
  return out
}

export type SearchFilters = { safeSearch: boolean; musicOnly: boolean }

export async function searchVideos(q: string, f: SearchFilters): Promise<YtVideo[]> {
  const params: Record<string, string> = { part: "snippet", q, type: "video", maxResults: "30", safeSearch: f.safeSearch ? "strict" : "none" }
  if (f.musicOnly) params.videoCategoryId = "10"
  const data = await get<{ items: { id: { videoId: string } }[] }>("search", params)
  const ids = data.items.map((i) => i.id.videoId).filter(Boolean)
  const details = await videoDetails(ids)
  // keep search order
  const byId = new Map(details.map((d) => [d.id, d]))
  return ids.map((id) => byId.get(id)).filter((v): v is YtVideo => Boolean(v))
}

export async function playlistWithVideos(playlistId: string): Promise<YtPlaylist> {
  const meta = await get<{ items: { id: string; snippet: { title: string; channelTitle: string; thumbnails?: Record<string, { url: string }> }; contentDetails: { itemCount: number } }[] }>("playlists", { part: "snippet,contentDetails", id: playlistId })
  const p = meta.items[0]
  if (!p) throw new YoutubeApiError("That playlist doesn't exist or is private. Private playlists are under “My playlists” once you're signed in.")
  const ids: string[] = []
  let pageToken: string | undefined
  do {
    const page = await get<{ items: { contentDetails: { videoId: string } }[]; nextPageToken?: string }>("playlistItems", { part: "contentDetails", playlistId, maxResults: "50", ...(pageToken ? { pageToken } : {}) })
    ids.push(...page.items.map((i) => i.contentDetails.videoId).filter(Boolean))
    pageToken = page.nextPageToken
  } while (pageToken && ids.length < 2000)
  const details = await videoDetails(ids)
  const byId = new Map(details.map((d) => [d.id, d]))
  return {
    id: p.id,
    title: p.snippet.title,
    channel: p.snippet.channelTitle,
    thumbnail: thumb(p.snippet.thumbnails),
    count: p.contentDetails.itemCount,
    // ids missing from the details response are private/deleted
    videos: ids.map((id) => byId.get(id) ?? { id, title: "Unavailable video", channel: "", duration: 0, thumbnail: null, unavailable: true }),
  }
}

export async function searchPlaylists(q: string, f: SearchFilters): Promise<YtPlaylist[]> {
  const data = await get<{ items: { id: { playlistId: string } }[] }>("search", { part: "snippet", q, type: "playlist", maxResults: "15", safeSearch: f.safeSearch ? "strict" : "none" })
  const ids = data.items.map((i) => i.id.playlistId).filter(Boolean)
  const settled = await Promise.allSettled(ids.map(playlistWithVideos))
  return settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
}

export function parseYoutubeUrl(input: string): { videoId?: string; playlistId?: string } {
  const s = input.trim()
  const list = /[?&]list=([A-Za-z0-9_-]+)/.exec(s)?.[1]
  const video = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/|music\.youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/.exec(s)?.[1] ?? (/^[A-Za-z0-9_-]{11}$/.test(s) ? s : undefined)
  const bareList = /^(?:PL|UU|FL|OL|RD|LL)[A-Za-z0-9_-]+$/.test(s) ? s : undefined
  return { videoId: video, playlistId: list ?? bareList }
}
