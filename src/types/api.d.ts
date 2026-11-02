import type { Song } from "./DirectoryTypes"

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }

export type RepeatMode = "off" | "all" | "one"

export type Settings = {
  theme: string
  volume: number
  repeat: RepeatMode
  shuffle: boolean
  autoplayRadio: boolean
  expandOnPlay: boolean
  zenMode: boolean
  zenTimeout: number
  youtubeAuth: { mode: "none" | "browser" | "file"; browser: string; profile: string }
}

export type Playlist = {
  id: string
  name: string
  description: string
  created: number
  updated: number
  songIds: string[]
  unresolvedPaths?: string[]
}

export type UserSnapshot = {
  playlists: Playlist[]
  likes: { songId: string; likedAt: number }[]
  recentlyPlayed: { songId: string; playedAt: number | null; legacy?: boolean }[]
  recentlyDownloaded: string[]
  recentPlaylists: string[]
  settings: Settings
  notices: { id: string; createdAt: number; message: string }[]
  legacyUnresolved: { kind: string; path: string | null; title: string | null; origin: string }[]
}

export type LibrarySnapshot = { rootDir: string | null; songs: Song[] }
export type LibraryDelta =
  | { type: "reset"; snapshot: LibrarySnapshot }
  | { type: "upsert"; songs: Song[] }
  | { type: "remove"; ids: string[] }

export type ScanSummary = { added: number; updated: number; relinked: number; missing: number; total: number }
export type AddSongsResult = { added: string[]; duplicates: string[]; invalid: string[] }

type Unsubscribe = () => void

export type RawApi = {
  library: {
    get(): Promise<IpcResult<LibrarySnapshot>>
    rescan(): Promise<IpcResult<ScanSummary>>
    selectFolder(): Promise<IpcResult<{ rootDir: string; summary: ScanSummary } | null>>
    deleteSong(songId: string): Promise<IpcResult<{ deleted: string; how: string }>>
    showInFolder(songId: string): Promise<IpcResult<null>>
    onChanged(cb: (delta: LibraryDelta) => void): Unsubscribe
  }
  user: {
    get(): Promise<IpcResult<UserSnapshot>>
    setLiked(songId: string, liked: boolean): Promise<IpcResult<boolean>>
    createPlaylist(input: { name: string; description?: string; songIds?: string[] }): Promise<IpcResult<Playlist>>
    updatePlaylist(id: string, patch: { name?: string; description?: string }): Promise<IpcResult<Playlist>>
    deletePlaylist(id: string): Promise<IpcResult<boolean>>
    addSongsToPlaylist(id: string, songIds: string[]): Promise<IpcResult<AddSongsResult>>
    removeSongFromPlaylist(id: string, songId: string): Promise<IpcResult<boolean>>
    reorderPlaylist(id: string, songIds: string[]): Promise<IpcResult<boolean>>
    addSongToPlaylists(songId: string, playlistIds: string[]): Promise<IpcResult<{ added: string[]; duplicates: string[]; missing: string[] }>>
    recordRecentlyPlayed(songId: string): Promise<IpcResult<null>>
    recordRecentPlaylist(id: string): Promise<IpcResult<null>>
    updateSettings(patch: Partial<Settings>): Promise<IpcResult<Settings>>
    dismissNotice(id: string): Promise<IpcResult<null>>
    importLegacy(dump: Record<string, string | null>, origin: string): Promise<IpcResult<unknown>>
    onChanged(cb: (snap: UserSnapshot) => void): Unsubscribe
  }
  youtube: {
    download(input: { videoId: string; title: string }): Promise<IpcResult<{ song: Song; alreadyHad: boolean }>>
    cancelAll(): Promise<IpcResult<{ cancelled: boolean }>>
    onProgress(cb: (p: { videoId: string; percent: number }) => void): Unsubscribe
    onComplete(cb: (p: { videoId: string; song: Song; success: boolean }) => void): Unsubscribe
  }
  sync: {
    toPhone(data: { rootPath: string }): Promise<SyncResult>
    checkAdb(): Promise<{ success: boolean; error?: string; deviceId?: string; message?: string; needsAdb?: boolean; needsDevice?: boolean; needsAuth?: boolean }>
    onProgress(cb: (p: { status: string; file?: string; message: string }) => void): Unsubscribe
  }
}

export type SyncResult = {
  success: boolean
  synced: string[]
  skipped: string[]
  deleted: string[]
  errors: { file: string; error: string }[]
  message?: string
  error?: string
}

declare global {
  interface Window {
    api: RawApi
  }
}
