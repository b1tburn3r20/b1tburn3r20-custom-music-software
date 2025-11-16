import { create } from "zustand"
import { type LightDirectory, type FolderDetails } from "../types/DirectoryTypes"

type DirectoryStore = {
  currentDir: FolderDetails | null
  setCurrentDir: (data: FolderDetails | null) => void
  rootDir: string | null
  setRootDir: (path: string) => void
  dirData: LightDirectory[] | null
  setDirData: (data: LightDirectory[]) => void
  updateFolderInDirData: (folderPath: string, updatedFolder: LightDirectory) => void // ADD THIS
  //
  playlistToDelete: FolderDetails | null
  setPlaylistToDelete: (data: FolderDetails | null) => void
  playlistToDeleteModalOpen: boolean;
  setPlaylistToDeleteModalOpen: (data: boolean) => void
  //
  songToDelete: FolderDetails | null
  setSongToDelete: (data: FolderDetails | null) => void
  songToDeleteModalOpen: boolean;
  setSongToDeleteModalOpen: (data: boolean) => void
  //
  reset: () => void
}

const initialState = {
  dirData: null,
  currentDir: null,
  rootDir: null,
  songToDelete: null,
  songToDeleteModalOpen: false,
  playlistToDelete: null,
  playlistToDeleteModalOpen: false,
}

export const useDirectoryStore = create<DirectoryStore>((set) => ({
  ...initialState,
  setPlaylistToDeleteModalOpen: (data: boolean) => set({ playlistToDeleteModalOpen: data }),
  setSongToDeleteModalOpen: (data: boolean) => set({ songToDeleteModalOpen: data }),
  setSongToDelete: (data: FolderDetails | null) => set({ songToDelete: data }),
  setPlaylistToDelete: (data: FolderDetails | null) => set({ playlistToDelete: data }),
  setDirData: (data: LightDirectory[]) => set({ dirData: data }),
  setCurrentDir: (data: FolderDetails | null) => set({ currentDir: data }),
  setRootDir: (path: string) => set({ rootDir: path }),
  updateFolderInDirData: (folderPath: string, updatedFolder: LightDirectory) => set((state) => {
    if (!state.dirData) return state;

    // Find the index of the folder to update
    const index = state.dirData.findIndex(folder => folder.path === folderPath);
    if (index === -1) return state; // Folder not found, no update needed

    // Create a new array with the updated folder
    const newDirData = [...state.dirData];
    newDirData[index] = updatedFolder;

    return { dirData: newDirData };
  }),
  reset: () => set(initialState)
}))
