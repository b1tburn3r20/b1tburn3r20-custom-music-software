// Public playback API for components. Every "play" in the app goes through here.
import { usePlayerStore } from "@/stores/usePlayerStore"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { useUserStore } from "@/stores/useUserStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { recordRecentPlaylist, updateSettings } from "@/lib/actions"
import { radioFor } from "@/lib/catalog"
import { debounce } from "@/lib/debounce"
import type { Song } from "@/types/DirectoryTypes"
import * as Q from "./queue"
import { advance, currentTime, getAudio, restartCurrent, startEngine, RADIO_BATCH } from "./engine"
import { toast } from "sonner"
import { useSelectionStore } from "@/stores/useSelectionStore"
import { dialogs } from "@/stores/useDialogStore"

const store = () => usePlayerStore.getState()

function expandIfWanted() {
  const { expandOnPlay, setPlayerExpanded } = useSettingsStore.getState()
  if (expandOnPlay) setPlayerExpanded(true)
}

const ids = (songs: readonly (Song | string)[]) => songs.map((s) => (typeof s === "string" ? s : s.id))

/**
 * Play a list (playlist, album, search results, liked songs…) starting at
 * `startIndex`. The queue becomes the whole list; next/previous continue from there.
 */
export function playContext(songs: readonly (Song | string)[], startIndex: number, context: Q.QueueContext | null) {
  const list = ids(songs)
  if (!list.length) return
  store().setQueue(Q.playContext(store().queue, list, startIndex, context))
  store().setPaused(false)
  if (context?.type === "playlist" && context.id) recordRecentPlaylist(context.id)
  expandIfWanted()
}

/** Play `song` from `list` (the list it was clicked in). */
export function playFromList(list: readonly Song[], song: Song, context: Q.QueueContext | null) {
  const idx = list.findIndex((s) => s.id === song.id)
  playContext(list, Math.max(0, idx), context)
}

/** Single song with no surrounding list: start a radio queue seeded by it. */
export function playRadio(seed: Song) {
  const lib = useLibraryStore.getState()
  // Start small; the engine tops the queue up as you get near the end.
  const more = radioFor(lib.songs, seed, new Set([seed.id]), RADIO_BATCH - 1, Math.random, useUserStore.getState().songTags)
  playContext([seed, ...more], 0, { type: "radio", id: seed.id, label: `${seed.metadata.title} radio` })
}

export function playShuffled(songs: readonly Song[], context: Q.QueueContext | null) {
  if (!songs.length) return
  setShuffle(true)
  playContext(songs, Math.floor(Math.random() * songs.length), context)
}

export function togglePlay() {
  if (!store().currentSongId) return
  store().setPaused(!store().paused)
}
export const pause = () => store().setPaused(true)
export const resume = () => store().currentSongId && store().setPaused(false)

export function next() {
  advance({ auto: false })
}

/** Previous: restart the song if more than 3 s in, otherwise go to the previous one. */
export function prev() {
  if (currentTime() > 3) return restartCurrent()
  const r = Q.prev(store().queue)
  if (r.restart) return restartCurrent()
  store().setQueue(r.queue)
}

export function seek(seconds: number) {
  const a = getAudio()
  if (a && Number.isFinite(seconds)) a.currentTime = Math.max(0, seconds)
}

export function jumpTo(uid: string) {
  store().setQueue(Q.jumpTo(store().queue, uid))
  store().setPaused(false)
}

export function playNext(songs: readonly (Song | string)[]) {
  const list = ids(songs)
  if (!list.length) return
  const wasEmpty = !store().currentSongId
  store().setQueue(Q.playNext(store().queue, list))
  if (wasEmpty) store().setPaused(false)
  toast.success(list.length === 1 ? "Playing next" : `${list.length} songs playing next`)
}

export function addToQueue(songs: readonly (Song | string)[]) {
  const list = ids(songs)
  if (!list.length) return
  const wasEmpty = !store().currentSongId
  store().setQueue(Q.addToQueue(store().queue, list))
  if (wasEmpty) store().setPaused(false)
  toast.success(list.length === 1 ? "Added to queue" : `Added ${list.length} songs to queue`)
}

export function removeFromQueue(uid: string) {
  store().setQueue(Q.removeUid(store().queue, uid).queue)
}

/** Called when songs are deleted from the library. */
export function removeSongsFromQueue(songIds: string[]) {
  const r = Q.removeSongs(store().queue, new Set(songIds))
  store().setQueue(r.queue)
  if (!Q.currentSongId(r.queue)) store().setPaused(true)
}

export function setShuffle(on: boolean) {
  store().setQueue(Q.setShuffle(store().queue, on))
  void updateSettings({ shuffle: on })
}
export const toggleShuffle = () => setShuffle(!store().queue.shuffle)

export function setRepeat(repeat: Q.RepeatMode) {
  store().setQueue(Q.setRepeat(store().queue, repeat))
  void updateSettings({ repeat })
}
export const cycleRepeat = () => setRepeat(Q.cycleRepeat(store().queue.repeat))

const persistVolume = debounce((volume: number) => void updateSettings({ volume }), 400)
export function setVolume(volume: number) {
  store().setVolume(volume)
  persistVolume(Math.round(volume))
}

let initialized = false
/** Start the engine and apply persisted settings (volume, repeat, shuffle). Call once. */
export function initPlayer() {
  if (initialized) return
  initialized = true
  const applySettings = () => {
    const s = useUserStore.getState().settings
    const q = store().queue
    usePlayerStore.setState({ volume: s.volume })
    if (q.repeat !== s.repeat || q.shuffle !== s.shuffle) store().setQueue(Q.setShuffle(Q.setRepeat(q, s.repeat), s.shuffle))
  }
  // Apply once settings arrive from main, then only on later external changes.
  const unsub = useUserStore.subscribe((u, p) => {
    if (u.loaded && !p.loaded) {
      applySettings()
      unsub()
    }
  })
  if (useUserStore.getState().loaded) applySettings()
  startEngine({ next, prev, togglePlay })
  window.addEventListener("keydown", (e) => {
    // T: tag the playing song (song rows and multi-selection handle their own T)
    if (e.key.toLowerCase() === "t" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || t.closest("[role=dialog],[role=menu],[data-song-row]"))) return
      if (useSelectionStore.getState().ids.size) return
      const song = store().currentlyPlaying
      if (song) {
        e.preventDefault()
        dialogs().openTags([song])
      }
      return
    }
    if (e.code !== "Space" || e.repeat) return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || t.closest("[role=dialog],[role=menu]"))) return
    e.preventDefault()
    togglePlay()
  })
  // Deleted songs leave the queue immediately.
  useLibraryStore.subscribe((lib, prevLib) => {
    if (lib.songsById === prevLib.songsById) return
    const gone = store().queue.items.filter((i) => !lib.songsById[i.songId]).map((i) => i.songId)
    if (gone.length && lib.loaded) removeSongsFromQueue(gone)
  })
}
