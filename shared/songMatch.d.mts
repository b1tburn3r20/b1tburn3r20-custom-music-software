export type MatchMeta = { title: string; artist: string; artists?: string[]; duration?: number }
export type MatchVideo = { id?: string; title: string; channel?: string; duration?: number }
export function parseVideoTitle(videoTitle: string): { artist: string; title: string }
export function normalizeSongTitle(title: string): string
export function isSameSong(song: MatchMeta, video: MatchVideo): boolean
export function findOwnedSong<S extends { sourceId?: string | null; metadata?: MatchMeta }>(songs: readonly S[], video: MatchVideo & { id: string }, getMeta?: (s: S) => MatchMeta | undefined): { song: S; exact: boolean } | null
