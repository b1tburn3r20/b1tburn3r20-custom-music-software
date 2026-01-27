import type { PlaylistType } from "@/types/AppTypes"
import { create } from "zustand"

type AppStore = {
  view: string
  setView: (data: string) => void
  currentPlaylist: PlaylistType | null
  setCurrentPlaylist: (data: PlaylistType) => void
  query: string | null
  setQuery: (data: string | null) => void
  idle: boolean
  setIdle: (data: boolean) => void
}


const initialState = {
  view: "home",
  currentPlaylist: null,
  query: null,
  idle: false
}

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,
  setQuery: (data: string | null) => set({ query: data }),
  setView: (view: string) => set({ view }),
  setIdle: (idle: boolean) => set({ idle }),
  setCurrentPlaylist: (data: PlaylistType) => set({ currentPlaylist: data }),
}))
