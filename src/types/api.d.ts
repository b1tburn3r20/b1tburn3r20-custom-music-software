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
  /** Full-screen player background: blurred cover art, or an audio visualizer. */
  playerBackground: "artwork" | "visualizer"
  /** Visualizer scene id, or "cycle" for a different one each song. */
  visualizer: string
  /** Extra delay (ms) for the visualizer on top of the reported audio output latency. */
  visualizerOffsetMs: number
  youtubeAuth: { mode: "none" | "browser" | "file"; browser: string; profile: string }
  /** A yt-dlp release the user chose not to be asked about again. */
  ytDlpSkippedVersion: string | null
  /** First-run setup: whether it's still to do, and which step someone left it at. */
  onboarding: { status: "pending" | "done"; step: string }
  youtubeCardDismissed: boolean
  aiProvider: AiProvider
  aiTier: AiTier
}

export type AiProvider = "anthropic" | "openai"
export type AiTier = "low" | "medium" | "high"
export type AiProgress = { running: boolean; done: number; total: number; tagged: number; failed: number; error: { code: string; message: string } | null }
export type AiStatus = AiProgress & {
  hasKey: Record<AiProvider, boolean>
  secureStorage: boolean
  unreadable: string[]
  providers: Record<AiProvider, { label: string; keysUrl: string; tiers: Record<AiTier, { name: string; songsPerDollar: number }> }>
}

/** Which YouTube features are unlocked. Yes/no facts only: secrets never reach the renderer. */
export type YoutubeAccess = {
  hasApiKey: boolean
  hasOAuthClient: boolean
  connected: boolean
  /** Google ended the sign-in, so the user needs to connect again. */
  needsReconnect: boolean
  channel: { id: string; title: string; thumbnail: string | null } | null
  cookieMode: boolean
  /** False on Linux with no keyring: credentials can't be properly encrypted. */
  secureStorage: boolean
  /** Saved credentials that couldn't be decrypted, so the user must enter them again. */
  unreadable: string[]
}

export type AccountVideo = { id: string; title: string; channel: string; duration: number; thumbnail: string | null; embeddable?: boolean; isMusic?: boolean; unavailable?: boolean }
/** The user's own YouTube data, kept on this computer for at most 30 days without a refresh. */
export type YoutubeAccount = {
  fetchedAt: number | null
  channel: YoutubeAccess["channel"]
  playlists: { id: string; title: string; count: number | null; thumbnail: string | null }[]
  liked: AccountVideo[]
  subscriptions: { channelId: string; title: string; thumbnail: string | null }[]
  dismissed: string[]
}
type SyncResult_ = { syncError: { code: string; message: string } | null }

export type ToolInfo = { name: string; path: string | null; source: "env" | "private" | "path" | "missing" }
export type ToolStatus = Record<"yt-dlp" | "ffmpeg" | "ffprobe" | "node" | "adb", ToolInfo>
export type YtDlpState = {
  status: "idle" | "checking" | "up-to-date" | "available" | "unmanaged" | "unknown" | "downloading" | "installing" | "waiting" | "error"
  current: string | null
  latest: string | null
  source: ToolInfo["source"] | null
  percent?: number | null
  error?: string | null
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
  /** Newest first. */
  recentlyDownloaded: string[]
  /** songId -> download time (ms); missing for downloads made before this was tracked. */
  downloadedAt: Record<string, number>
  recentPlaylists: string[]
  settings: Settings
  notices: { id: string; createdAt: number; message: string }[]
  /** songId -> your own tags */
  songTags: Record<string, string[]>
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
    /** Sets the OS Music folder if no folder is set yet. Never replaces an existing one. */
    ensureDefaultFolder(): Promise<IpcResult<{ applied: boolean; rootDir: string | null; summary?: ScanSummary; attempted?: string; error?: string }>>
    openFolder(): Promise<IpcResult<null>>
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
    setSongTags(songIds: string[], tags: string[]): Promise<IpcResult<string[]>>
    changeTag(songIds: string[], tag: string, add: boolean): Promise<IpcResult<string>>
    renameTag(from: string, to: string): Promise<IpcResult<string>>
    deleteTag(tag: string): Promise<IpcResult<null>>
    importLegacy(dump: Record<string, string | null>, origin: string): Promise<IpcResult<unknown>>
    onChanged(cb: (snap: UserSnapshot) => void): Unsubscribe
  }
  youtube: {
    access(): Promise<IpcResult<YoutubeAccess>>
    onAccessChanged(cb: (access: YoutubeAccess) => void): Unsubscribe
    account(): Promise<IpcResult<YoutubeAccount>>
    onAccountChanged(cb: (account: YoutubeAccount) => void): Unsubscribe
    setClient(input: { clientId: string; clientSecret: string } | string, opts?: { allowWeak?: boolean }): Promise<IpcResult<{ persisted: boolean }>>
    connect(opts?: { allowWeak?: boolean }): Promise<IpcResult<SyncResult_>>
    cancelConnect(): Promise<IpcResult<null>>
    refreshAccount(): Promise<IpcResult<SyncResult_>>
    disconnect(opts?: { removeMirrors?: boolean }): Promise<IpcResult<{ revoked: boolean }>>
    removeClient(): Promise<IpcResult<{ revoked: boolean }>>
    dismissSuggestion(id: string): Promise<IpcResult<null>>
    setApiKey(key: string, opts?: { allowWeak?: boolean }): Promise<IpcResult<{ persisted: boolean }>>
    removeApiKey(): Promise<IpcResult<null>>
    videoDetails(ids: string[]): Promise<IpcResult<import("@/lib/youtubeApi").YtVideo[]>>
    searchVideos(q: string, filters: import("@/lib/youtubeApi").SearchFilters): Promise<IpcResult<import("@/lib/youtubeApi").YtVideo[]>>
    searchPlaylists(q: string, filters: import("@/lib/youtubeApi").SearchFilters): Promise<IpcResult<import("@/lib/youtubeApi").YtPlaylist[]>>
    publicPlaylist(id: string): Promise<IpcResult<import("@/lib/youtubeApi").YtPlaylist>>
    lookupLink(link: { videoId?: string; playlistId?: string }): Promise<IpcResult<{ videos?: import("@/lib/youtubeApi").YtVideo[]; playlists?: import("@/lib/youtubeApi").YtPlaylist[] }>>
    authStatus(): Promise<IpcResult<YoutubeAuthStatus>>
    setAuth(patch: Partial<Settings["youtubeAuth"]>): Promise<IpcResult<YoutubeAuthStatus>>
    importCookies(): Promise<IpcResult<{ imported: string } | null>>
    removeCookies(): Promise<IpcResult<YoutubeAuthStatus>>
    checkAuth(): Promise<IpcResult<{ ok: true; playlists: number; downloadIssue: string | null } | { ok: false; code: string; message: string; at: number }>>
    myPlaylists(): Promise<IpcResult<MyYoutubePlaylist[]>>
    playlistItems(id: string): Promise<IpcResult<{ id: string; title: string; channel: string; videos: { id: string; title: string; channel: string; duration: number; thumbnail: string | null; unavailable: boolean }[] }>>
    enqueue(videos: { videoId: string; title: string; channel?: string; duration?: number; index?: number }[], opts?: { playlistId?: string; mirror?: { youtubeId: string; title: string } }): Promise<IpcResult<{ items: DownloadItem[]; playlistId: string | null }>>
    downloads(): Promise<IpcResult<DownloadItem[]>>
    cancel(videoId?: string): Promise<IpcResult<boolean>>
    clearFinished(): Promise<IpcResult<DownloadItem[]>>
    download(input: { videoId: string; title: string }): Promise<IpcResult<{ songId: string; alreadyHad: boolean }>>
    onDownloadUpdate(cb: (item: DownloadItem) => void): Unsubscribe
  }
  tools: {
    status(): Promise<IpcResult<ToolStatus>>
    ytDlpState(): Promise<IpcResult<YtDlpState>>
    checkYtDlp(): Promise<IpcResult<YtDlpState>>
    updateYtDlp(): Promise<IpcResult<YtDlpState>>
    onYtDlpState(cb: (state: YtDlpState) => void): Unsubscribe
  }
  ai: {
    status(): Promise<IpcResult<AiStatus>>
    setKey(provider: AiProvider, key: string, opts?: { allowWeak?: boolean }): Promise<IpcResult<{ persisted: boolean }>>
    removeKey(provider: AiProvider): Promise<IpcResult<null>>
    start(opts: { vocabulary: string[] }): Promise<IpcResult<AiProgress>>
    cancel(): Promise<IpcResult<AiProgress>>
    onProgress(cb: (progress: AiProgress) => void): Unsubscribe
  }
  window: {
    isFullscreen(): Promise<IpcResult<boolean>>
    toggleFullscreen(): Promise<IpcResult<null>>
    onFullscreenChanged(cb: (fullscreen: boolean) => void): Unsubscribe
  }
  positions: {
    get(songId: string): Promise<IpcResult<number | null>>
    set(songId: string, positionSec: number | null): Promise<IpcResult<null>>
  }
  stats: {
    recordPlay(event: { songId: string; startedAt: number; endedAt: number; listenedMs: number; durationMs: number; counted: boolean; context?: { type: string; id?: string } | null }): Promise<IpcResult<boolean>>
    get(range: StatsRange): Promise<IpcResult<StatsSummary>>
    history(opts?: { limit?: number; before?: number }): Promise<IpcResult<PlayEvent[]>>
    forgotten(opts?: { minPlays?: number; olderThanDays?: number; limit?: number }): Promise<IpcResult<{ songId: string; plays: number; ms: number; lastPlayedAt: number }[]>>
    radioSignals(): Promise<IpcResult<RadioSignals>>
    onChanged(cb: (p: { at: number }) => void): Unsubscribe
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

export type StatsRange = "week" | "month" | "all"
export type StatsSummary = {
  range: StatsRange
  since: number | null
  totalMs: number
  plays: number
  uniqueSongs: number
  uniqueArtists: number
  topSongs: { songId: string; plays: number; ms: number; lastPlayedAt: number }[]
  topArtists: { name: string; plays: number; ms: number; songCount: number }[]
  daily: { day: string; ms: number }[]
}
export type RadioSignals = {
  songs: Record<string, { plays: number; skips: number; lastPlayedAt: number; lastSkippedAt: number }>
  /** songId → songs you chose to hear near it → how often */
  together: Record<string, Record<string, number>>
}
export type PlayEvent = { id: string; songId: string; endedAt: number; listenedMs: number; counted: boolean }

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
