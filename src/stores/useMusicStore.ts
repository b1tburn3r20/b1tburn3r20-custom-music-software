import type { AlbumType, ArtistType, PlaylistType } from "@/types/AppTypes"
import type { Song } from "@/types/DirectoryTypes"
import { create } from "zustand"

export type CacheSongType = {
  id: string
  title: string
  artist: string
  path: string
  thumbnail: string | null
}

/**
 * Transitional view-model store. The list fields below are *derived* from
 * useLibraryStore + useUserStore by src/data/legacyBridge.ts and must not be
 * mutated directly — use the functions in src/lib/actions.ts instead.
 */
type MusicStore = {
  // derived (read-only)
  songCache: CacheSongType[]
  likedSongs: Song[]
  recentlyPlayed: Song[]
  recentlyDownloaded: Song[]
  playlists: PlaylistType[]
  recentlyPlayedPlaylists: PlaylistType[]
  randomMusic: Song[]
  allAlbums: AlbumType[]

  // UI state
  musicResults: Song[]
  setMusicResults: (data: Song[]) => void
  isPlaylistModalOpen: boolean
  setIsPlaylistModalOpen: (data: boolean) => void
  playlistUpdateData: Song | null
  setPlaylistUpdateData: (data: Song | null) => void
  diceIndex: number
  setDiceIndex: (data: number) => void
  playlistDiceIndex: number
  setPlaylistDiceIndex: (data: number) => void
  activeAlbum: AlbumType | null
  setActiveAlbum: (data: AlbumType | null) => void
  activeArtist: ArtistType | null
  setActiveArtist: (data: ArtistType | null) => void
}

export const useMusicStore = create<MusicStore>((set) => ({
  songCache: [],
  likedSongs: [],
  recentlyPlayed: [],
  recentlyDownloaded: [],
  playlists: [],
  recentlyPlayedPlaylists: [],
  randomMusic: [],
  allAlbums: [],

  musicResults: [],
  setMusicResults: (musicResults) => set({ musicResults }),
  isPlaylistModalOpen: false,
  setIsPlaylistModalOpen: (isPlaylistModalOpen) => set({ isPlaylistModalOpen }),
  playlistUpdateData: null,
  setPlaylistUpdateData: (playlistUpdateData) => set({ playlistUpdateData }),
  diceIndex: 5,
  setDiceIndex: (diceIndex) => set({ diceIndex }),
  playlistDiceIndex: 3,
  setPlaylistDiceIndex: (playlistDiceIndex) => set({ playlistDiceIndex }),
  activeAlbum: null,
  setActiveAlbum: (activeAlbum) => set({ activeAlbum }),
  activeArtist: null,
  setActiveArtist: (activeArtist) => set({ activeArtist }),
}))
