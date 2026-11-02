import type { Song } from "./DirectoryTypes"

export type AlbumType = {
  /** Stable key: album name + main artist, so same-named albums by different artists stay separate. */
  key: string
  album_artists: string[]
  album_name: string
  album_release_date: number[]
  album_songs: Song[]
  album_thumbnail: string | null
}

export type ArtistType = {
  key: string
  artist_albums: AlbumType[]
  artist_name: string
  artist_songs: Song[]
  artist_thumbnail: string | null
}
