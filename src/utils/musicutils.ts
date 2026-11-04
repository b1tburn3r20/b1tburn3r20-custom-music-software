import { navigate } from "@/stores/useAppStore"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { albumForSong } from "@/lib/catalog"
import { playRadio } from "@/player/controls"
import type { Song } from "@/types/DirectoryTypes"
import { toast } from "sonner"

/** Single song with no list around it: radio queue seeded by the song. */
export const startNewQueue = (songOrId: Song | string | null | undefined) => {
  const lib = useLibraryStore.getState()
  const seed = typeof songOrId === "string" ? lib.songsById[songOrId] : songOrId
  if (seed) playRadio(seed)
}

export const openAlbumForSong = (songId: string) => {
  const album = albumForSong(useLibraryStore.getState().albums, songId)
  if (!album) {
    toast.info("This song has no album information")
    return
  }
  navigate({ name: "album", key: album.key })
}

export const openArtist = (artistName: string) => navigate({ name: "artist", artist: artistName.trim() })
