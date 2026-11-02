import { recordRecentlyPlayed, setLiked } from "@/lib/actions"
import { shuffled } from "@/lib/catalog"
import type { Song } from "@/types/DirectoryTypes"

export const shuffleArray = <T,>(array: readonly T[]): T[] => shuffled(array)

export const addRecentlyPlayed = (song: Song | null | undefined) => {
  if (song?.id) recordRecentlyPlayed(song.id)
}

export const addLikedSong = (song: Song) => setLiked(song.id, true)
export const removeLikedSong = (song: Song) => setLiked(song.id, false)
