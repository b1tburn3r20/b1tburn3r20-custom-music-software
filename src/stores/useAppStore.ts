import type { PlaylistType } from "@/types/AppTypes"
import { create } from "zustand"

type AppStore = {
  view: string
  setView: (data: string) => void
  currentPlaylist: PlaylistType | null
  setCurrentPlaylist: (data: PlaylistType | null) => void
  query: string | null
  setQuery: (data: string | null) => void
  idle: boolean
  setIdle: (data: boolean) => void
  playlistForDelete: PlaylistType | null
  setPlaylistForDelete: (data: PlaylistType | null) => void
  playlistForRename: PlaylistType | null
  setPlaylistForRename: (data: PlaylistType) => void
}


const initialState = {
  view: "home",
  currentPlaylist: null,
  query: null,
  idle: false,
  playlistForDelete: null,
  playlistForRename: null,
}

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,
  setQuery: (data: string | null) => set({ query: data }),
  setView: (view: string) => set({ view }),
  setIdle: (idle: boolean) => set({ idle }),
  setCurrentPlaylist: (data: PlaylistType | null) => set({ currentPlaylist: data }),
  setPlaylistForDelete: (data: PlaylistType | null) => set({ playlistForDelete: data }),
  setPlaylistForRename: (data: PlaylistType | null) => set({ playlistForRename: data }),
}))
