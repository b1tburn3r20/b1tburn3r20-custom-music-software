import { create } from "zustand"
import type { Song } from "@/types/DirectoryTypes"

export type PlaylistFormState = { mode: "create"; songIds?: string[] } | { mode: "edit"; playlistId: string }

/** Every app-level dialog, opened from anywhere via these actions. */
type DialogState = {
  songToDelete: Song | null
  addToPlaylistSongs: Song[] | null
  playlistForm: PlaylistFormState | null
  playlistToDelete: string | null
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
  confirmDeleteSong: (songToDelete) => set({ songToDelete }),
  openAddToPlaylist: (addToPlaylistSongs) => set({ addToPlaylistSongs }),
  openPlaylistForm: (playlistForm) => set({ playlistForm }),
  confirmDeletePlaylist: (playlistToDelete) => set({ playlistToDelete }),
}))

export const dialogs = () => useDialogStore.getState()
