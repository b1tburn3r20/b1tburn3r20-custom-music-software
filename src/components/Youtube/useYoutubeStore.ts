import { type YoutubeDetailsResult, type YoutubePlaylistResultType } from "@/types/YoutubeTypes"
import { create } from "zustand"


export type YoutubeStore = {
  searchTerm: string
  setSearchTerm: (data: string) => void
  results: YoutubeDetailsResult[]
  setResults: (data: YoutubeDetailsResult[]) => void
  searchingYoutube: boolean
  setSearchingYoutube: (data: boolean) => void
  playlists: boolean
  setPlaylists: (data: boolean) => void
  youtubePlaylistResults: YoutubePlaylistResultType[]
  setYoutubePlaylistResults: (data: YoutubePlaylistResultType[]) => void
  // filters
  officialFilter: boolean
  setOfficialFilter: (data: boolean) => void

  safeSearch: boolean
  setSafeSearch: (data: boolean) => void

  musicCategoryOnly: boolean
  setMusicCategoryOnly: (data: boolean) => void


  //
  triggerSearchKey: number
  incrementTriggerSearchKey: () => void
}

const initialState = {
  searchTerm: "",
  results: [],
  searchingYoutube: false,
  playlists: false,
  youtubePlaylistResults: [],
  triggerSearchKey: 0,
  officialFilter: false,
  safeSearch: false,
  musicCategoryOnly: false,
}

export const useYoutubeStore = create<YoutubeStore>((set) => ({
  ...initialState,
  setSearchTerm: (data: string) => set({ searchTerm: data }),
  setResults: (data: YoutubeDetailsResult[]) => set({ results: data }),
  setSearchingYoutube: (data: boolean) => set({ searchingYoutube: data }),
  setPlaylists: (data: boolean) => set({ playlists: data }),
  setYoutubePlaylistResults: (data: YoutubePlaylistResultType[]) => set({ youtubePlaylistResults: data }),
  setOfficialFilter: (data: boolean) => set({ officialFilter: data }),
  setSafeSearch: (data: boolean) => set({ safeSearch: data }),
  setMusicCategoryOnly: (data: boolean) => set({ musicCategoryOnly: data }),
  //
  incrementTriggerSearchKey: () => set((state) => ({ triggerSearchKey: state.triggerSearchKey + 1 }))
})) 
