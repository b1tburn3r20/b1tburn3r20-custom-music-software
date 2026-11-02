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
  source?: { type: "youtube"; id: string }
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
    orphanReport(): Promise<IpcResult<OrphanReport>>
    orphanCleanup(opts: { thumbnails?: boolean; dangling?: boolean; missingIds?: string[] }): Promise<IpcResult<{ thumbsRemoved: number; refsRemoved: number; forgotten: number }>>
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
    authStatus(): Promise<IpcResult<YoutubeAuthStatus>>
    setAuth(patch: Partial<Settings["youtubeAuth"]>): Promise<IpcResult<YoutubeAuthStatus>>
    importCookies(): Promise<IpcResult<{ imported: string } | null>>
    removeCookies(): Promise<IpcResult<YoutubeAuthStatus>>
    checkAuth(): Promise<IpcResult<{ ok: true; playlists: number } | { ok: false; code: string; message: string; at: number }>>
    myPlaylists(): Promise<IpcResult<MyYoutubePlaylist[]>>
    playlistItems(id: string): Promise<IpcResult<{ id: string; title: string; channel: string; videos: { id: string; title: string; channel: string; duration: number; thumbnail: string | null; unavailable: boolean }[] }>>
    enqueue(videos: { videoId: string; title: string }[], opts?: { playlistId?: string; mirror?: { youtubeId: string; title: string } }): Promise<IpcResult<{ items: DownloadItem[]; playlistId: string | null }>>
    downloads(): Promise<IpcResult<DownloadItem[]>>
    cancel(videoId?: string): Promise<IpcResult<boolean>>
    clearFinished(): Promise<IpcResult<DownloadItem[]>>
    download(input: { videoId: string; title: string }): Promise<IpcResult<{ songId: string; alreadyHad: boolean }>>
    onDownloadUpdate(cb: (item: DownloadItem) => void): Unsubscribe
  }
  sync: {
    toPhone(data: { rootPath: string }): Promise<SyncResult>
    checkAdb(): Promise<{ success: boolean; error?: string; deviceId?: string; message?: string; needsAdb?: boolean; needsDevice?: boolean; needsAuth?: boolean }>
    onProgress(cb: (p: { status: string; file?: string; message: string }) => void): Unsubscribe
  }
}

export type DownloadStatus = "queued" | "downloading" | "done" | "error" | "cancelled" | "skipped"
export type DownloadItem = { videoId: string; title: string; status: DownloadStatus; percent: number; error: { code: string; message: string } | null; songId: string | null; note: string | null; playlistId: string | null; addedAt: number }
export type YoutubeAuthStatus = {
  mode: "none" | "browser" | "file"
  browser: string
  profile: string
  hasCookieFile: boolean
  browsers: { id: string; label: string; installed: boolean }[]
  lastCheck: { ok: boolean; at: number; code?: string; message?: string; playlists?: number } | null
}
export type MyYoutubePlaylist = { id: string; title: string; count: number | null; thumbnail: string | null; system?: boolean }
export type OrphanReport = { orphanThumbnails: number; orphanThumbnailBytes: number; missing: { id: string; title: string; path: string }[]; danglingReferences: number }

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
