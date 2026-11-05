// Public YouTube search and lookups. The calls run in the main process, which holds the
// user's API key, so the key is never available to this code.
import { call } from "@/lib/api"

export type YtVideo = { id: string; title: string; channel: string; duration: number; thumbnail: string | null; embeddable?: boolean; unavailable?: boolean }
export type YtPlaylist = { id: string; title: string; channel: string; thumbnail: string | null; count: number | null; videos: YtVideo[] }
export type SearchFilters = { safeSearch: boolean; musicOnly: boolean }

export const videoDetails = (ids: string[]) => call(window.api.youtube.videoDetails(ids))
export const searchVideos = (q: string, f: SearchFilters) => call(window.api.youtube.searchVideos(q, f))
export const searchPlaylists = (q: string, f: SearchFilters) => call(window.api.youtube.searchPlaylists(q, f))
export const playlistWithVideos = (playlistId: string) => call(window.api.youtube.publicPlaylist(playlistId))
/** Opens a pasted link. Works with no API key, through yt-dlp. */
export const lookupLink = (link: { videoId?: string; playlistId?: string }) => call(window.api.youtube.lookupLink(link))

export function parseYoutubeUrl(input: string): { videoId?: string; playlistId?: string } {
  const s = input.trim()
  const list = /[?&]list=([A-Za-z0-9_-]+)/.exec(s)?.[1]
  const video = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/|music\.youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/.exec(s)?.[1] ?? (/^[A-Za-z0-9_-]{11}$/.test(s) ? s : undefined)
  const bareList = /^(?:PL|UU|FL|OL|RD|LL)[A-Za-z0-9_-]+$/.test(s) ? s : undefined
  return { videoId: video, playlistId: list ?? bareList }
}
