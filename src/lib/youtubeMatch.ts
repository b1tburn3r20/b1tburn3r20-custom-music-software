import type { CacheSongType } from "@/stores/useMusicStore"
import { useLibraryStore } from "@/stores/useLibraryStore"

/**
 * Finds the library song for a YouTube video. Exact match is by YouTube video id
 * (recorded for every download since the overhaul). Older downloads have no id,
 * so fall back to a case-insensitive title match and report it as "likely".
 */
export function findDownloaded(videoId: string, title: string, cache: CacheSongType[]): { song: CacheSongType; exact: boolean } | null {
  const lib = useLibraryStore.getState().songs
  const exact = lib.find((s) => s.sourceId === videoId)
  if (exact) {
    const c = cache.find((s) => s.id === exact.id)
    if (c) return { song: c, exact: true }
  }
  const t = title.trim().toLowerCase()
  const byTitle = cache.find((s) => s.title.trim().toLowerCase() === t)
  return byTitle ? { song: byTitle, exact: false } : null
}
