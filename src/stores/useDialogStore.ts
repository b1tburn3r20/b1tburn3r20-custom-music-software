import { create } from "zustand"
import type { Song } from "@/types/DirectoryTypes"

export type PlaylistFormState = { mode: "create"; songIds?: string[] } | { mode: "edit"; playlistId: string }

/** Every app-level dialog, opened from anywhere via these actions. */
type DialogState = {
  songToDelete: Song | null
  addToPlaylistSongs: Song[] | null
  playlistForm: PlaylistFormState | null
  playlistToDelete: string | null
  tagSongs: Song[] | null
  shortcutsOpen: boolean
  equalizerOpen: boolean
  openEqualizer: (open: boolean) => void
  openShortcuts: (open: boolean) => void
  zenSearchOpen: boolean
  openZenSearch: (open: boolean) => void
  openTags: (songs: Song[] | null) => void
  confirmDeleteSong: (song: Song | null) => void
  openAddToPlaylist: (songs: Song[] | null) => void
  openPlaylistForm: (form: PlaylistFormState | null) => void
  confirmDeletePlaylist: (playlistId: string | null) => void
}

export const useDialogStore = create<DialogState>((set) => ({
  songToDelete: null,
  addToPlaylistSongs: null,
  playlistForm: null,
  playlistToDelete: null,
  tagSongs: null,
  shortcutsOpen: false,
  equalizerOpen: false,
  openEqualizer: (equalizerOpen) => set({ equalizerOpen }),
  openShortcuts: (shortcutsOpen) => set({ shortcutsOpen }),
  zenSearchOpen: false,
  openZenSearch: (zenSearchOpen) => set({ zenSearchOpen }),
  openTags: (tagSongs) => set({ tagSongs }),
  confirmDeleteSong: (songToDelete) => set({ songToDelete }),
  openAddToPlaylist: (addToPlaylistSongs) => set({ addToPlaylistSongs }),
  openPlaylistForm: (playlistForm) => set({ playlistForm }),
  confirmDeletePlaylist: (playlistToDelete) => set({ playlistToDelete }),
}))

export const dialogs = () => useDialogStore.getState()
