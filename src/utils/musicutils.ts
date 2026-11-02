import { useAppStore } from "@/stores/useAppStore"
import { useMusicStore } from "@/stores/useMusicStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { albumForSong, buildArtist, radioFor } from "@/lib/catalog"
import { recordRecentPlaylist } from "@/lib/actions"
import type { AlbumType, PlaylistType } from "@/types/AppTypes"
import type { Song } from "@/types/DirectoryTypes"
import { toast } from "sonner"

const expandIfWanted = () => {
  const { expandOnPlay, setPlayerExpanded } = useSettingsStore.getState()
  if (expandOnPlay) setPlayerExpanded(true)
}

/** Radio queue: the song followed by similar songs (same artist first). */
export const startNewQueue = (songOrId: Song | string | null | undefined) => {
  const lib = useLibraryStore.getState()
  const seed = typeof songOrId === "string" ? lib.songsById[songOrId] ?? lib.songs.find((s) => s.path === songOrId) : songOrId
  if (!seed) return
  const queue = [seed, ...radioFor(lib.songs, seed, new Set())]
  usePlayerStore.getState().setPlayingPlaylist(null)
  useMusicStore.getState().setPlayingAlbum(null)
  useMusicStore.getState().setQueue(queue)
  usePlayerStore.getState().setCurrentlyPlaying(seed)
  usePlayerStore.getState().setPaused(false)
  expandIfWanted()
}

export const startNewQueueFromArray = (array: Song[], playlist?: PlaylistType, album?: AlbumType, startIndex = 0) => {
  if (!array.length) return
  useMusicStore.getState().setQueue(array)
  usePlayerStore.getState().setPlayingPlaylist(playlist ?? null)
  useMusicStore.getState().setPlayingAlbum(album ?? null)
  if (playlist) recordRecentPlaylist(playlist.id)
  usePlayerStore.getState().setCurrentlyPlaying(array[Math.min(Math.max(startIndex, 0), array.length - 1)])
  usePlayerStore.getState().setPaused(false)
  expandIfWanted()
}

export const extendQueue = (seed: Song) => {
  const lib = useLibraryStore.getState()
  const { queue, setQueue } = useMusicStore.getState()
  const more = radioFor(lib.songs, seed, new Set(queue.map((s) => s.id)))
  if (more.length) setQueue([...queue, ...more])
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
