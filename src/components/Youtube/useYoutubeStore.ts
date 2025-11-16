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
}

const initialState = {
  searchTerm: "",
  results: [],
  searchingYoutube: false,
  playlists: false,
  youtubePlaylistResults: [],
}

export const useYoutubeStore = create<YoutubeStore>((set) => ({
  ...initialState,
  setSearchTerm: (data: string) => set({ searchTerm: data }),
  setResults: (data: YoutubeDetailsResult[]) => set({ results: data }),
  setSearchingYoutube: (data: boolean) => set({ searchingYoutube: data }),
  setPlaylists: (data: boolean) => set({ playlists: data }),
  setYoutubePlaylistResults: (data: YoutubePlaylistResultType[]) => set({ youtubePlaylistResults: data }),
})) 
