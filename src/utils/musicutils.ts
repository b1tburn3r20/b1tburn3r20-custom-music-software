import { useAppStore } from "@/stores/useAppStore"
import { useMusicStore } from "@/stores/useMusicStore"
import { playContext, playRadio } from "@/player/controls"
import type { QueueContext } from "@/player/queue"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { albumForSong, buildArtist } from "@/lib/catalog"
import type { AlbumType, PlaylistType } from "@/types/AppTypes"
import type { Song } from "@/types/DirectoryTypes"
import { toast } from "sonner"

/** Single song with no list around it: radio queue seeded by the song. */
export const startNewQueue = (songOrId: Song | string | null | undefined) => {
  const lib = useLibraryStore.getState()
  const seed = typeof songOrId === "string" ? lib.songsById[songOrId] ?? lib.songs.find((s) => s.path === songOrId) : songOrId
  if (seed) playRadio(seed)
}

/** Play a whole list starting at `startIndex` (queue = the list). */
export const startNewQueueFromArray = (array: Song[], playlist?: PlaylistType, album?: AlbumType, startIndex = 0, context?: QueueContext) => {
  const ctx: QueueContext =
    context ??
    (playlist
      ? { type: "playlist", id: playlist.id, label: playlist.name }
      : album
        ? { type: "album", id: album.key, label: album.album_name }
        : { type: "list", label: "Queue" })
  playContext(array, startIndex, ctx)
}

export const openAlbumForSong = (songId: string) => {
  const album = albumForSong(useLibraryStore.getState().albums, songId)
  if (!album) {
    toast.info("This song has no album information")
    return
  }
  useMusicStore.getState().setActiveAlbum(album)
  useAppStore.getState().setView("album")
}

export const openArtist = (artistName: string) => {
  const lib = useLibraryStore.getState()
  const artist = buildArtist(lib.songs, lib.albums, artistName)
  if (!artist) {
    toast.info(`No songs by "${artistName}" in your library`)
    return
  }
  useMusicStore.getState().setActiveArtist(artist)
  useAppStore.getState().setView("artist")
}

export const handleArtistClick = (e: React.MouseEvent, artistName: string) => {
  e.stopPropagation()
  openArtist(artistName)
}
