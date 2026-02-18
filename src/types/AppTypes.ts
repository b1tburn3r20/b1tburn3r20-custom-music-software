import type { Song } from "./DirectoryTypes"

export type PlaylistType = {
  created: number
  description: string
  id: string
  name: string
  songs: Song[]
  updated: number
}

export type AlbumType = {
  album_artists: string[]
  album_name: string
  album_release_date: number[]
  album_songs: Song[]
  album_thumbnail: string
}
export type ArtistType = {
  artist_albums: AlbumType[]
  artist_name: string
  artist_thumbnail: string
}
