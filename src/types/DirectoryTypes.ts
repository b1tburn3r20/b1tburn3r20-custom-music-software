import { type MP3Metadata } from "../stores/usePlayerStore"

export type LightDirectory = {
  name: string
  path: string
  songCount: number
  thumbnails: string[]
  songs: Song[]
}

export type Song = {
  name: string
  path: string
  metadata: MP3Metadata
  folderName?: string
  folderPath?: string
}
export type FolderDetails = {
  playlistName: string
  songs: Song[]
  path: string
  thumbnails: string[]
  error?: string
}


