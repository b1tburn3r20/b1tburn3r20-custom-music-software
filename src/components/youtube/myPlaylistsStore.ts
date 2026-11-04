import { create } from "zustand"
import { ApiError, call } from "@/lib/api"
import type { MyYoutubePlaylist } from "@/types/api"
import type { YtVideo } from "@/lib/youtubeApi"

type Items = { videos: YtVideo[] | null; loading: boolean; error: string | null }

/**
 * The signed-in user's YouTube playlists and their videos, cached for the session
 * so switching tabs/pages doesn't refetch. "Refresh" (or a sign-in change) resyncs.
 */
type MyPlaylistsState = {
  playlists: MyYoutubePlaylist[] | null
  loading: boolean
  error: { code: string; message: string } | null
  /** Auth mode the cached data was fetched with. */
  fetchedFor: string | null
  items: Record<string, Items>
  /** Playlist panels the user has expanded (kept across remounts). */
  open: Record<string, boolean>
  loadPlaylists: (mode: string, force?: boolean) => Promise<void>
  loadItems: (id: string, force?: boolean) => Promise<void>
  setOpen: (id: string, open: boolean) => void
}

export const useMyPlaylistsStore = create<MyPlaylistsState>((set, get) => ({
  playlists: null,
  loading: false,
  error: null,
  fetchedFor: null,
  items: {},
  open: {},
  loadPlaylists: async (mode, force = false) => {
    const s = get()
    if (s.loading) return
    if (!force && s.fetchedFor === mode && s.playlists) return
    const accountChanged = s.fetchedFor !== mode
    set({ loading: true, error: null, ...(accountChanged ? { playlists: null, items: {}, open: {} } : {}) })
    try {
      const playlists = await call(window.api.youtube.myPlaylists())
      // A resync also refetches the videos of playlists that are open; closed ones load when opened.
      set({ playlists, fetchedFor: mode, items: {} })
      for (const [id, isOpen] of Object.entries(get().open)) if (isOpen) void get().loadItems(id)
    } catch (err) {
      set({ error: { code: err instanceof ApiError ? err.code : "ERROR", message: (err as Error).message }, fetchedFor: mode })
    } finally {
      set({ loading: false })
    }
  },
  loadItems: async (id, force = false) => {
    const cur = get().items[id]
    if (cur?.loading || (!force && cur?.videos)) return
    set((s) => ({ items: { ...s.items, [id]: { videos: cur?.videos ?? null, loading: true, error: null } } }))
    try {
      const { videos } = await call(window.api.youtube.playlistItems(id))
      set((s) => ({ items: { ...s.items, [id]: { videos, loading: false, error: null } } }))
    } catch (err) {
      set((s) => ({ items: { ...s.items, [id]: { videos: cur?.videos ?? null, loading: false, error: (err as Error).message } } }))
    }
  },
  setOpen: (id, open) => set((s) => ({ open: { ...s.open, [id]: open } })),
}))
