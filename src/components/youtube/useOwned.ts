import { useMemo } from "react"
import { useLibraryStore } from "@/stores/useLibraryStore"
import type { Song } from "@/types/DirectoryTypes"

/** Lookup of library songs by YouTube id, plus a weaker title match for downloads made before ids were recorded. */
export function useOwnedIndex() {
  const songs = useLibraryStore((s) => s.songs)
  return useMemo(() => {
    const bySource = new Map<string, Song>()
    const byTitle = new Map<string, Song[]>()
    for (const s of songs) {
      if (s.sourceId) bySource.set(s.sourceId, s)
      else {
        const k = s.metadata.title.trim().toLowerCase()
        byTitle.set(k, [...(byTitle.get(k) ?? []), s])
      }
    }
    return (videoId: string, title: string): { song: Song; exact: boolean } | null => {
      const exact = bySource.get(videoId)
      if (exact) return { song: exact, exact: true }
      const t = byTitle.get(title.trim().toLowerCase())
      return t && t.length === 1 ? { song: t[0], exact: false } : null
    }
  }, [songs])
}
