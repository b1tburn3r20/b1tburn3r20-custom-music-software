import type { Song } from "@/types/DirectoryTypes"
import { create } from "zustand"

type MusicStore = {
  musicResults: Song[]
  setMusicResults: (data: Song[]) => void
  randomMusic: Song[]
  setRandomMusic: (data: Song[]) => void

  recentlyPlayed: Song[]
  setRecentlyPlayed: (data: Song[]) => void

}

const initialState = {
  musicResults: [],
  randomMusic: [],
  recentlyPlayed: [],
}

export const useMusicStore = create<MusicStore>((set) => ({
  ...initialState,
  setMusicResults: (musicResults: Song[]) => set({ musicResults }),
  setRandomMusic: (randomMusic: Song[]) => set({ randomMusic }),
  setRecentlyPlayed: (recentlyPlayed: Song[]) => set({ recentlyPlayed })
}))
