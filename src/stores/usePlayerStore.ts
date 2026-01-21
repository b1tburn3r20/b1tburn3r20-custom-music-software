import { create } from "zustand"
import { type Song } from "../types/DirectoryTypes"
import type { FolderDetails } from "@/types/DirectoryTypes";

export interface MP3Metadata {
  title: string;
  artist: string;
  album: string;
  duration: number;
  durationFormatted: string;
  year: number | null;
  genre: string | null;
  thumbnail: string | null;
  uploader: string;
  channel: string;
  description: string;
  viewCount: number;
  likeCount: number;
  uploadDate: string;
}

type PlayerStore = {
  currentlyPlaying: Song | null
  setCurrentlyPlaying: (data: Song | null) => void
  paused: boolean
  setPaused: (data: boolean) => void
  looping: string
  setLooping: (data: string) => void
  musicIsPlaying: boolean
  setMusicIsPlaying: (data: boolean) => void
  musicVolume: number
  setMusicVolume: (data: number) => void
  musicProgress: number
  setMusicProgress: (data: number) => void
  playingPlaylist: FolderDetails | null
  setPlayingPlaylist: (data: FolderDetails | null) => void
  audioRef: HTMLAudioElement | null





  setAudioRef: (ref: HTMLAudioElement | null) => void
  seek: (progressPercent: number) => void
}

const initialState = {
  currentlyPlaying: null,
  musicIsPlaying: false,
  musicVolume: 50,
  musicProgress: 0,
  paused: false,
  looping: "loopPlaylist",
  audioRef: null as HTMLAudioElement | null,
  playingPlaylist: null
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  ...initialState,
  setLooping: (data: string) => set({ looping: data }),
  setPaused: (data: boolean) => set({ paused: data }),
  setMusicVolume: (data: number) => set({ musicVolume: data }),
  setCurrentlyPlaying: (data: Song | null) => set({ currentlyPlaying: data }),
  setMusicIsPlaying: (data: boolean) => set({ musicIsPlaying: data }),
  setMusicProgress: (data: number) => set({ musicProgress: data }),
  setPlayingPlaylist: (playingPlaylist: FolderDetails | null) => set({ playingPlaylist }),
  setAudioRef: (ref: HTMLAudioElement | null) => set({ audioRef: ref }),
  seek: (progressPercent: number) => {
    const { audioRef, currentlyPlaying } = get();
    if (audioRef && currentlyPlaying?.metadata?.duration) {
      const duration = currentlyPlaying.metadata.duration;
      audioRef.currentTime = (progressPercent / 100) * duration;
    }
    set({ musicProgress: progressPercent });
  },
}))
