import { create } from "zustand"
import type { Song } from "@/types/DirectoryTypes"
import { currentItem, emptyQueue, type QueueContext, type QueueState } from "@/player/queue"
import { useLibraryStore } from "./useLibraryStore"

type PlayerState = {
  queue: QueueState
  /** Id of the song that is loaded in the engine. */
  currentSongId: string | null
  /** uid of the current queue entry (distinguishes duplicates). */
  currentUid: string | null
  /** Resolved Song for currentSongId (kept fresh when the library changes). */
  currentlyPlaying: Song | null
  paused: boolean
  /** Volume 0–100 (instant UI value; persisted to settings with a debounce). */
  volume: number
  /** Incremented to force the engine to restart the current song from 0. */
  restartToken: number
  setQueue: (queue: QueueState) => void
  setPaused: (paused: boolean) => void
  setVolume: (volume: number) => void
  bumpRestart: () => void
}

function deriveCurrent(queue: QueueState) {
  const item = currentItem(queue)
  const songId = item?.songId ?? null
  return { currentSongId: songId, currentUid: item?.uid ?? null, currentlyPlaying: songId ? useLibraryStore.getState().songsById[songId] ?? null : null }
}

export const usePlayerStore = create<PlayerState>((set) => ({
  queue: emptyQueue(),
  currentSongId: null,
  currentUid: null,
  currentlyPlaying: null,
  paused: true,
  volume: 50,
  restartToken: 0,
  setQueue: (queue) => set({ queue, ...deriveCurrent(queue) }),
  setPaused: (paused) => set({ paused }),
  setVolume: (volume) => set({ volume: Math.min(100, Math.max(0, volume)) }),
  bumpRestart: () => set((s) => ({ restartToken: s.restartToken + 1 })),
}))

// Keep the resolved Song fresh (metadata edits, re-links) without restarting playback.
useLibraryStore.subscribe((lib, prev) => {
  if (lib.songsById === prev.songsById) return
  const { currentSongId, currentlyPlaying } = usePlayerStore.getState()
  const fresh = currentSongId ? lib.songsById[currentSongId] ?? null : null
  if (fresh !== currentlyPlaying) usePlayerStore.setState({ currentlyPlaying: fresh })
})

export const selectContext = (s: PlayerState): QueueContext | null => s.queue.context

/** Small, separate store for the playback clock so 4×/s updates only re-render the progress UI. */
type ClockState = { time: number; duration: number; setClock: (time: number, duration: number) => void }
export const usePlaybackClock = create<ClockState>((set) => ({
  time: 0,
  duration: 0,
  setClock: (time, duration) => set({ time, duration }),
}))
