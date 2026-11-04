import { useCallback } from "react"
import { useLibraryStore } from "@/stores/useLibraryStore"
import type { Song } from "@/types/DirectoryTypes"
import { findOwnedSong } from "../../../shared/songMatch.mjs"

export type VideoRef = { id: string; title: string; channel?: string; duration?: number }

/**
 * Is this YouTube video already in the library? Exact YouTube id, or — for songs
 * downloaded before ids were recorded — a strict title + artist + length match
 * (same matcher the download queue uses). A title alone is never enough.
 */
export function useOwnedIndex() {
  const songs = useLibraryStore((s) => s.songs)
  return useCallback(
    (v: VideoRef): { song: Song; exact: boolean } | null =>
      findOwnedSong(songs, { id: v.id, title: v.title, channel: v.channel ?? "", duration: v.duration ?? 0 }) as { song: Song; exact: boolean } | null,
    [songs],
  )
}
