import { create } from "zustand"
import type { LibraryDelta, LibrarySnapshot } from "@/types/api"
import type { Song } from "@/types/DirectoryTypes"
import type { AlbumType } from "@/types/AppTypes"
import { buildAlbums } from "@/lib/catalog"

type LibraryState = {
  loaded: boolean
  rootDir: string | null
  songsById: Record<string, Song>
  /** All songs, newest first. Recomputed only when the library changes. */
  songs: Song[]
  albums: AlbumType[]
  setSnapshot: (snap: LibrarySnapshot) => void
  applyDelta: (delta: LibraryDelta) => void
}

function derive(songsById: Record<string, Song>) {
  const songs = Object.values(songsById).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0) || a.metadata.title.localeCompare(b.metadata.title))
  return { songsById, songs, albums: buildAlbums(songs) }
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  loaded: false,
  rootDir: null,
  songsById: {},
  songs: [],
  albums: [],
  setSnapshot: (snap) => {
    const byId: Record<string, Song> = {}
    for (const s of snap.songs) byId[s.id] = s
    set({ loaded: true, rootDir: snap.rootDir, ...derive(byId) })
  },
  applyDelta: (delta) => {
    if (delta.type === "reset") return get().setSnapshot(delta.snapshot)
    const byId = { ...get().songsById }
    if (delta.type === "upsert") for (const s of delta.songs) byId[s.id] = s
    if (delta.type === "remove") for (const id of delta.ids) delete byId[id]
    set(derive(byId))
  },
}))

export const getSong = (id: string | null | undefined): Song | null => (id ? useLibraryStore.getState().songsById[id] ?? null : null)

export const resolveSongs = (ids: readonly string[], byId = useLibraryStore.getState().songsById): Song[] => {
  const out: Song[] = []
  for (const id of ids) {
    const s = byId[id]
    if (s) out.push(s)
  }
  return out
}
