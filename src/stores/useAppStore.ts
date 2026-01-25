import { create } from "zustand"

type AppStore = {
  view: string
  setView: (data: string) => void
  currentPlaylist: any
  setCurrentPlaylist: (data: any) => void
  query: string | null
  setQuery: (data: string | null) => void
}


const initialState = {
  view: "home",
  currentPlaylist: null,
  query: null
}

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,
  setQuery: (data: string | null) => set({ query: data }),
  setView: (view: string) => set({ view }),
  setCurrentPlaylist: (data: any) => set({ currentPlaylist: data }),
}))
