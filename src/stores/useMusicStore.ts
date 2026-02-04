import { localStorageRemoveSong } from "@/components/helpers/utilities"
import type { PlaylistType } from "@/types/AppTypes"
import type { Song } from "@/types/DirectoryTypes"
import { removeSongFromActivePlaylist } from "@/utils/musicutils"
import { create } from "zustand"

export type CacheSongType = {
  title: string
  artist: string
  path: string
  thumbnail: string
}

type MusicStore = {

  musicResults: Song[]
  setMusicResults: (data: Song[]) => void

  songCache: CacheSongType[]
  setSongCache: (data: CacheSongType[]) => void


  randomMusic: Song[]
  setRandomMusic: (data: Song[]) => void

  recentlyPlayed: Song[]
  setRecentlyPlayed: (data: Song[]) => void

  recentlyDownloaded: Song[]
  setRecentlyDownloaded: (data: Song[]) => void

  queue: Song[]
  setQueue: (data: Song[]) => void

  newQueueKey: number
  setNewQueueKey: (data: number) => void

  isPlaylistModalOpen: boolean
  setIsPlaylistModalOpen: (data: boolean) => void

  playlistUpdateData: Song | null
  setPlaylistUpdateData: (data: Song | null) => void

  playlists: PlaylistType[]
  setPlaylists: (data: PlaylistType[]) => void

  diceIndex: number
  setDiceIndex: (data: number) => void


  // helper zuxios
  addSong: (song: Song) => void
  removeSong: (song: Song) => void
  addSongToCache: (song: CacheSongType) => void
  replacePlaylist: (playlist: PlaylistType) => void
  addPlaylist: (playlist: PlaylistType) => void
  removePlaylist: (id: string) => void
  addSongToPlaylist: (playlistId: string, song: Song) => void
}

const initialState = {
  musicResults: [],
  randomMusic: [],
  recentlyPlayed: [],
  recentlyDownloaded: [],
  songCache: [],
  queue: [],
  newQueueKey: 0,
  isPlaylistModalOpen: false,
  playlistUpdateData: null,
  playlists: [],
  diceIndex: 1,
}

export const useMusicStore = create<MusicStore>((set) => ({
  ...initialState,
  setMusicResults: (musicResults: Song[]) => set({ musicResults }),
  setPlaylists: (data: PlaylistType[]) => set({ playlists: data }),
  setIsPlaylistModalOpen: (data: boolean) => set({ isPlaylistModalOpen: data }),
  setPlaylistUpdateData: (data: Song | null) => set({ playlistUpdateData: data }),
  setRandomMusic: (randomMusic: Song[]) => set({ randomMusic }),
  setRecentlyPlayed: (recentlyPlayed: Song[]) => set({ recentlyPlayed }),
  setRecentlyDownloaded: (recentlyDownloaded: Song[]) => set({ recentlyDownloaded }),
  setQueue: (queue: Song[]) => set({ queue }),
  setDiceIndex: (data: number) => set({ diceIndex: data }),
  setNewQueueKey: (newQueueKey: number) => set({ newQueueKey }),
  setSongCache: (songCache: CacheSongType[]) => set({ songCache }),
  addSong: (song: Song) =>
    set((state) => ({
      recentlyPlayed: [...state.recentlyPlayed, song]
    })),
  addSongToCache: (song: CacheSongType) =>
    set((state) => ({
      songCache: [...state.songCache, song]
    })),
  removeSong: (song: Song) => {
    set((state) => ({
      randomMusic: state.randomMusic.filter((s) => s.path !== song.path),
      musicResults: state.musicResults.filter((s) => s.path !== song.path),
      recentlyPlayed: state.recentlyPlayed.filter((s) => s.path !== song.path),
      recentlyDownloaded: state.recentlyDownloaded.filter((s) => s.path !== song.path),
      songCache: state.songCache.filter((s) => s.path !== song.path),
      queue: state.queue.filter((s) => s.path !== song.path),

      playlists: state.playlists.map((playlist) => ({
        ...playlist,
        songs: playlist.songs.filter((s) => s.path !== song.path)
      }))
    })),
      localStorageRemoveSong(song)
    removeSongFromActivePlaylist(song)
  },
  replacePlaylist: (playlist: PlaylistType) => set((state) => ({
    playlists: state.playlists.map((p) => p.id === playlist.id ? playlist : p)
  })),
  addPlaylist: (playlist: PlaylistType) => set((state) => ({
    playlists: [...state.playlists, playlist]
  })),
  removePlaylist: (id: string) => set((state) => ({
    playlists: state.playlists.filter((pl) => pl.id !== id)
  })),
  addSongToPlaylist: (playlistId: string, song: Song) =>
    set((state) => ({
      playlists: state.playlists.map((pl) => {
        if (pl.id !== playlistId) return pl
        const alreadyExists = pl.songs.some((s) => s.path === song.path)
        if (alreadyExists) return pl
        return {
          ...pl,
          songs: [...pl.songs, song],
          updated: Date.now()
        }
      })
    }))
}))
