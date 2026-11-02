import { create } from "zustand"
import type { Song } from "../types/DirectoryTypes"

type DirectoryStore = {
  /** Mirrors useLibraryStore.rootDir (kept for existing components). */
  rootDir: string | null
  setRootDir: (path: string | null) => void
  /** Song awaiting delete confirmation (opens the DeleteSong dialog). */
  songToDelete: Song | null
  requestDeleteSong: (song: Song | null) => void
}

export const useDirectoryStore = create<DirectoryStore>((set) => ({
  rootDir: null,
  setRootDir: (rootDir) => set({ rootDir }),
  songToDelete: null,
  requestDeleteSong: (songToDelete) => set({ songToDelete }),
}))
