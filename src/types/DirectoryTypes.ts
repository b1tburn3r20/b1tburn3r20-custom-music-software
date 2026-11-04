export type SongMetadata = {
  title: string
  artist: string
  /** Individual artists split from the artist tag ("A, B feat. C" -> [A, B, C]). */
  artists: string[]
  album: string | null
  albumArtist: string | null
  duration: number
  durationFormatted: string
  year: number | null
  genre: string | null
  /** media://thumb/<id> URL, or null when the file has no embedded artwork. */
  thumbnail: string | null
  description: string
  uploadDate: string
}

/** A library song. `id` is the only identity — never title, filename or path. */
export type Song = {
  id: string
  /** File name on disk. */
  name: string
  path: string
  /** YouTube video id when the song was downloaded from YouTube. */
  sourceId: string | null
  addedAt: number
  metadata: SongMetadata
}
