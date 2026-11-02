import type { Song } from "@/types/DirectoryTypes"

/**
 * Finds the library song for a YouTube video. Exact match is by YouTube video id
 * (recorded for every download since the overhaul). Older downloads have no id,
 * so fall back to a case-insensitive title match ("likely").
 */
export function findDownloaded(videoId: string, title: string, songs: readonly Song[]): { song: Song; exact: boolean } | null {
  const exact = songs.find((s) => s.sourceId === videoId)
  if (exact) return { song: exact, exact: true }
  const t = title.trim().toLowerCase()
  const byTitle = songs.find((s) => s.metadata.title.trim().toLowerCase() === t)
  return byTitle ? { song: byTitle, exact: false } : null
}

export function artistMatches(channel: string, songs: readonly Song[]): boolean {
  const c = channel.toLowerCase()
  return songs.some((s) => s.metadata.artist && s.metadata.artist !== "Unknown Artist" && c.includes(s.metadata.artist.toLowerCase()))
}
