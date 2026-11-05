import { create } from "zustand"
import { ApiError } from "@/lib/api"
import { lookupLink, parseYoutubeUrl, searchPlaylists, searchVideos, type YtPlaylist, type YtVideo } from "@/lib/youtubeApi"
import { trackProgress } from "@/stores/useTopProgress"

/** The YouTube page's search box and its results (shared with the top bar and the Search page). */
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
  videoResults: YtVideo[] | null
  playlistResults: YtPlaylist[] | null
  searching: boolean
  /** Words were searched without an API key: only links work without one. */
  needsKey: boolean
  searchError: string | null
  /** Runs the box's contents: opens a link, or searches for words. */
  runSearch: (term?: string) => Promise<void>
}

/** Only the latest search may show its results, however the replies arrive. */
let latest = 0

export const useYoutubeStore = create<YoutubeStore>((set, get) => ({
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
  videoResults: null,
  playlistResults: null,
  searching: false,
  needsKey: false,
  searchError: null,
  runSearch: async (term) => {
    const { searchTerm, playlists, safeSearch, musicCategoryOnly } = get()
    const query = (term ?? searchTerm).trim()
    if (!query) return
    const run = ++latest
    set({ searching: true, searchError: null, needsKey: false, videoResults: null, playlistResults: null })
    const filters = { safeSearch, musicOnly: musicCategoryOnly }
    try {
      const link = parseYoutubeUrl(query)
      const result = link.playlistId || link.videoId ? await trackProgress(lookupLink(link)) : playlists ? { playlists: await trackProgress(searchPlaylists(query, filters)) } : { videos: await trackProgress(searchVideos(query, filters)) }
      if (run !== latest) return
      set({ videoResults: result.videos ?? null, playlistResults: result.playlists ?? null })
    } catch (err) {
      if (run !== latest) return
      if (err instanceof ApiError && err.code === "API_KEY_MISSING") set({ needsKey: true })
      else set({ searchError: (err as Error).message })
    } finally {
      if (run === latest) set({ searching: false })
    }
  },
}))
