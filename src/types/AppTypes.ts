import type { Song } from "./DirectoryTypes"

export type PlaylistType = {
  created: number
  description: string
  id: string
  name: string
  songs: Song[]
  updated: number
}

