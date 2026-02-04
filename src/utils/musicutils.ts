import { useAppStore } from "@/stores/useAppStore"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { useMusicStore } from "@/stores/useMusicStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import type { PlaylistType } from "@/types/AppTypes"
import type { Song } from "@/types/DirectoryTypes"


export const startNewQueue = async (path) => {
  const setQueue = useMusicStore.getState().setQueue
  const root = useDirectoryStore.getState().rootDir
  const setPlayingPlaylist = usePlayerStore.getState().setPlayingPlaylist
  const startPlaying = usePlayerStore.getState().setCurrentlyPlaying
  if (!path) {
    return
  }
  try {
    const response: any = await (window as any).electron.getSongQueue({ root, path })
    if (response?.error) {
      throw new Error(response.error)
    }

    setPlayingPlaylist(null)
    setQueue(response.songs)
    startPlaying(response?.songs[0])
  } catch (error) {
    console.error("This went wrong", error)
  }
}

export const startNewQueueFromArray = async (array: Song[], playlist: PlaylistType) => {
  const setQueue = useMusicStore.getState().setQueue
  const setPlayingPlaylist = usePlayerStore.getState().setPlayingPlaylist
  const startPlaying = usePlayerStore.getState().setCurrentlyPlaying
  setPlayingPlaylist(playlist)
  setQueue(array)
  startPlaying(array[0])
}


export const extendQueue = async (rootDir, path, songsToOmit) => {
  const setQueue = useMusicStore.getState().setQueue
  const queue = useMusicStore.getState().queue
  if (!path) {
    return
  }
  try {
    const response: any = await (window as any).electron.getSongQueue({ rootDir, path, songsToOmit })
    if (response?.error) {
      throw new Error(response.error)
    }
    const newQueue = [...queue, ...response.songs]
    setQueue(newQueue)
  } catch (error) {
    console.error("This went wrong", error)
  }
}

export const removeSongFromActivePlaylist = (song: Song) => {
  const activePlaylist = useAppStore.getState().currentPlaylist
  const setActivePlaylist = useAppStore.getState().setCurrentPlaylist
  if (activePlaylist) {
    const filteredPlaylist = activePlaylist.songs.filter((s) => s.path !== song.path)
    setActivePlaylist({ ...activePlaylist, songs: filteredPlaylist })
  }
}
export const removeSongFromPlaylistData = (song: Song, playlist: PlaylistType) => {
  const playlists = useMusicStore.getState().playlists
  const foundPlaylist = playlists.find((pl) => pl.id === playlist.id)
  const replacePlaylist = useMusicStore.getState().replacePlaylist
  if (foundPlaylist) {
    const filteredSongs = foundPlaylist.songs.filter((s) => s.path !== song.path)
    const newPL = { ...foundPlaylist, songs: filteredSongs }
    replacePlaylist(newPL)
  }

}

export const removePlaylist = (playlistId: string) => {
  const playlists = useMusicStore.getState().playlists
  const currentPlaylist = useAppStore.getState().currentPlaylist
  const setPlaylists = useMusicStore.getState().setPlaylists
  const setView = useAppStore.getState().setView
  const setCurrentPlaylist = useAppStore.getState().setCurrentPlaylist

  const filteredPlaylists = playlists.filter((pl) => pl.id !== playlistId)
  setPlaylists(filteredPlaylists)
  const openRN = currentPlaylist?.id === playlistId
  if (openRN) {
    setCurrentPlaylist(null)
    setView("home")
  }

}


