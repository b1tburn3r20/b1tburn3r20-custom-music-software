import { type MP3Metadata } from "../stores/usePlayerStore"

export type LightDirectory = {
  name: string
  isDirectory: boolean
  path: string
  songCount: number
  thumbnails: string[]
}

export type Song = {
  name: string
  path: string
  metadata: MP3Metadata
}
export type FolderDetails = {
  playlistName: string
  songs: Song[]
  path: string
  thumbnails: string[]
  error?: string
}


