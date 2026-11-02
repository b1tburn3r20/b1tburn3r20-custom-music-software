import { create } from "zustand"

/** YouTube search UI state (shared with the top bar and the Search page). */
type YoutubeStore = {
  searchTerm: string
  setSearchTerm: (data: string) => void
  /** true = search playlists, false = videos */
  playlists: boolean
  setPlaylists: (data: boolean) => void
  safeSearch: boolean
  setSafeSearch: (data: boolean) => void
  musicCategoryOnly: boolean
  setMusicCategoryOnly: (data: boolean) => void
  /** Increment to make the YouTube page run the current search. */
  triggerSearchKey: number
  incrementTriggerSearchKey: () => void
}

export const useYoutubeStore = create<YoutubeStore>((set) => ({
  searchTerm: "",
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  playlists: false,
  setPlaylists: (playlists) => set({ playlists }),
  safeSearch: false,
  setSafeSearch: (safeSearch) => set({ safeSearch }),
  musicCategoryOnly: false,
  setMusicCategoryOnly: (musicCategoryOnly) => set({ musicCategoryOnly }),
  triggerSearchKey: 0,
  incrementTriggerSearchKey: () => set((s) => ({ triggerSearchKey: s.triggerSearchKey + 1 })),
}))
