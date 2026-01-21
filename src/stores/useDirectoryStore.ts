import { create } from "zustand"
import { type LightDirectory, type FolderDetails, type Song } from "../types/DirectoryTypes"

type DirectoryStore = {
  currentDir: FolderDetails | null
  setCurrentDir: (data: FolderDetails | null) => void
  rootDir: string | null
  setRootDir: (path: string) => void
  dirData: LightDirectory[] | null
  setDirData: (data: LightDirectory[]) => void
  updateFolderInDirData: (folderPath: string, updatedFolder: LightDirectory) => void
  //
  playlistToDelete: LightDirectory | null
  setPlaylistToDelete: (data: LightDirectory | null) => void
  playlistToDeleteModalOpen: boolean;
  setPlaylistToDeleteModalOpen: (data: boolean) => void
  //
  songToDelete: Song | null
  setSongToDelete: (data: Song | null) => void
  songToDeleteModalOpen: boolean;
  setSongToDeleteModalOpen: (data: boolean) => void
  //
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



const arraysEqual = (arr1: any[], arr2: any[]): boolean => {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((item, idx) => item === arr2[idx]);
};

export const useDirectoryStore = create<DirectoryStore>((set) => ({
  ...initialState,
  setPlaylistToDeleteModalOpen: (data: boolean) => set({ playlistToDeleteModalOpen: data }),
  setSongToDeleteModalOpen: (data: boolean) => set({ songToDeleteModalOpen: data }),
  setSongToDelete: (data: Song | null) => set({ songToDelete: data }),
  setPlaylistToDelete: (data: LightDirectory | null) => set({ playlistToDelete: data }),

  setDirData: (data: LightDirectory[]) => {
    set({ dirData: data });
  },
  setCurrentDir: (data: FolderDetails | null) => {

    set({
      currentDir: data,
    });
  },

  setRootDir: (path: string) => set({ rootDir: path }),

  updateFolderInDirData: (folderPath: string, updatedFolder: LightDirectory) => set((state) => {
    if (!state.dirData) {
      return state;
    }
    const index = state.dirData.findIndex(folder => folder.path === folderPath);
    if (index === -1) {
      return state;
    }
    const oldFolder = state.dirData[index];
    const nameChanged = oldFolder.name !== updatedFolder.name;
    const pathChanged = oldFolder.path !== updatedFolder.path;
    const songCountChanged = oldFolder.songCount !== updatedFolder.songCount;
    const thumbnailsChanged = !arraysEqual(oldFolder.thumbnails, updatedFolder.thumbnails);
    if (!nameChanged && !pathChanged && !songCountChanged && !thumbnailsChanged) {
      return state;
    }
    const folderToStore: LightDirectory = thumbnailsChanged
      ? updatedFolder
      : { ...updatedFolder, thumbnails: oldFolder.thumbnails };
    const newDirData = [...state.dirData];
    newDirData[index] = folderToStore;
    return { dirData: newDirData };
  }),

  reset: () => set(initialState)
}));
