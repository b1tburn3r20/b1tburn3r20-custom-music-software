// The playback engine: owns the single <audio> element for the whole app.
// React components never create Audio objects; they read state from
// usePlayerStore / usePlaybackClock and call the functions in ./controls.
import { toast } from "sonner"
import { usePlaybackClock, usePlayerStore } from "@/stores/usePlayerStore"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { useUserStore } from "@/stores/useUserStore"
import { recordRecentlyPlayed } from "@/lib/actions"
import { radioFor } from "@/lib/catalog"
import * as Q from "./queue"
import { ListenTracker } from "./listenTracker"
import { isResumable, positionToStore, resumePosition } from "./resume"
import { formatDuration } from "@/utils/textUtils"

let audio: HTMLAudioElement | null = null
const tracker = new ListenTracker()
let loadedSongId: string | null = null
let consecutiveErrors = 0
let lastClock = 0
/** Changing src can emit a spurious 'pause'; ignore pauses right after a load. */
let ignorePauseUntil = 0

export const getAudio = () => audio
export const currentTime = () => audio?.currentTime ?? 0

const mediaUrl = (songId: string) => `media://song/${encodeURIComponent(songId)}`

function setClockNow() {
  if (!audio) return
  const d = Number.isFinite(audio.duration) ? audio.duration : usePlayerStore.getState().currentlyPlaying?.metadata.duration || 0
  usePlaybackClock.getState().setClock(audio.currentTime, d)
}

function safePlay() {
  if (!audio) return
  audio.play().catch((err: DOMException) => {
    if (err.name === "AbortError") return // superseded by another load
    console.warn("[engine] play() failed:", err.message)
    usePlayerStore.getState().setPaused(true)
  })
}

// ---------- resume position (tracks ≥ 10 min) ----------
let pendingResume: { songId: string; pos: number } | null = null
/** Song whose saved position has been checked/restored; saving is blocked until then. */
let resumeReadyFor: string | null = null
let lastPositionSave = 0

/** Persist (or forget) the current position of a long track. */
function savePosition(force = false) {
  if (!audio || !loadedSongId) return
  const dur = Number.isFinite(audio.duration) ? audio.duration : usePlayerStore.getState().currentlyPlaying?.metadata.duration || 0
  if (resumeReadyFor !== loadedSongId || pendingResume) return // not restored yet: never overwrite the saved spot
  if (!isResumable(dur)) return
  const now = performance.now()
  if (!force && now - lastPositionSave < 5000) return
  lastPositionSave = now
  window.api.positions.set(loadedSongId, positionToStore(audio.currentTime, dur)).catch(() => {})
}

async function fetchResume(songId: string, knownDuration: number) {
  if (knownDuration && !isResumable(knownDuration)) {
    resumeReadyFor = songId
    return
  }
  try {
    const res = await window.api.positions.get(songId)
    if (loadedSongId !== songId) return
    if (res.ok && res.data != null) {
      pendingResume = { songId, pos: res.data }
      applyResume()
    }
  } catch {
    /* no saved position */
  } finally {
    if (loadedSongId === songId) resumeReadyFor = songId
  }
}

/** Seek to the saved position once the track's duration is known. */
function applyResume() {
  if (!audio || !pendingResume || pendingResume.songId !== loadedSongId || !Number.isFinite(audio.duration)) return
  const pos = resumePosition(pendingResume.pos, audio.duration)
  pendingResume = null
  if (pos == null) return
  tracker.break()
  audio.currentTime = pos
  setClockNow()
  const songId = loadedSongId
  toast(`Resumed at ${formatDuration(pos)}`, {
    action: {
      label: "Start over",
      onClick: () => {
        if (audio && loadedSongId === songId) {
          audio.currentTime = 0
          window.api.positions.set(songId, null).catch(() => {})
        }
      },
    },
  })
}

/** Send a finished listening session to main (stats/history). */
function report(session: ReturnType<ListenTracker["finish"]>) {
  if (!session || session.listenedMs < 1000) return
  const ctx = usePlayerStore.getState().queue.context
  window.api.stats
    .recordPlay({ songId: session.songId, startedAt: session.startedAt, endedAt: session.endedAt, listenedMs: session.listenedMs, durationMs: Math.round(session.durationSec * 1000), counted: session.counted, context: ctx ? { type: ctx.type, id: ctx.id } : null })
    .catch((e: unknown) => console.warn("[engine] couldn't record play", e))
}

function load(songId: string | null) {
  if (!audio) return
  savePosition(true) // remember where the previous long track was left
  pendingResume = null
  resumeReadyFor = null
  loadedSongId = songId
  if (songId) report(tracker.start(songId, usePlayerStore.getState().currentlyPlaying?.metadata.duration || 0))
  else report(tracker.finish())
  if (!songId) {
    audio.removeAttribute("src")
    audio.load()
    usePlaybackClock.getState().setClock(0, 0)
    updateMediaSession()
    return
  }
  ignorePauseUntil = performance.now() + 750
  audio.src = mediaUrl(songId)
  void fetchResume(songId, usePlayerStore.getState().currentlyPlaying?.metadata.duration || 0)
  usePlaybackClock.getState().setClock(0, usePlayerStore.getState().currentlyPlaying?.metadata.duration || 0)
  if (!usePlayerStore.getState().paused) safePlay()
  recordRecentlyPlayed(songId)
  updateMediaSession()
}

/** Radio grows lazily: a few songs at a time, topped up near the end of the queue. */
export const RADIO_BATCH = 5
const RADIO_LOOKAHEAD = 2

/** Appends a few "radio" songs similar to the current one. Returns false when nothing could be added. */
export function appendRadio(count = RADIO_BATCH): boolean {
  const { queue, setQueue } = usePlayerStore.getState()
  const lib = useLibraryStore.getState()
  const lastId = Q.currentSongId(queue)
  const seed = lastId ? lib.songsById[lastId] : null
  if (!seed) return false
  const exclude = new Set(queue.items.map((i) => i.songId))
  const more = radioFor(lib.songs, seed, exclude, count, Math.random, useUserStore.getState().songTags)
  if (!more.length) return false
  setQueue(Q.addToQueue(queue, more.map((s) => s.id), "radio"))
  return true
}

/** Advance after the current track ends (or after an error). */
export function advance({ auto }: { auto: boolean }) {
  const store = usePlayerStore.getState()
  let r = Q.next(store.queue, { auto })
  if (r.ended && useUserStore.getState().settings.autoplayRadio && appendRadio()) {
    r = Q.next(usePlayerStore.getState().queue, { auto: false })
  }
  if (r.restart) {
    restartCurrent()
    return
  }
  if (r.ended) {
    report(tracker.finish())
    // End of queue: stop at the start of the last song.
    store.setPaused(true)
    if (audio) audio.currentTime = 0
    setClockNow()
    return
  }
  usePlayerStore.getState().setQueue(r.queue)
}

/** In a radio queue (or once autoplay has taken over), add a few more songs when only a couple are left. */
function topUpRadio(queue: Q.QueueState) {
  const cur = Q.currentItem(queue)
  if (!cur) return
  const isRadio = queue.context?.type === "radio" || cur.source === "radio"
  if (!isRadio || queue.repeat === "one") return
  if (Q.upcoming(queue).length <= RADIO_LOOKAHEAD) queueMicrotask(() => appendRadio())
}

export function restartCurrent() {
  if (!audio) return
  report(tracker.restart())
  audio.currentTime = 0
  setClockNow()
  if (!usePlayerStore.getState().paused) safePlay()
}

function onError() {
  const song = usePlayerStore.getState().currentlyPlaying
  consecutiveErrors++
  toast.error(`Couldn't play "${song?.metadata.title ?? "song"}"`, { description: "The file may be missing or unreadable." })
  if (consecutiveErrors >= 3) {
    usePlayerStore.getState().setPaused(true)
    consecutiveErrors = 0
    return
  }
  advance({ auto: false })
}

function updateMediaSession() {
  if (!("mediaSession" in navigator)) return
  const song = usePlayerStore.getState().currentlyPlaying
  if (!song) {
    navigator.mediaSession.metadata = null
    return
  }
  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.metadata.title,
    artist: song.metadata.artist,
    album: song.metadata.album ?? "",
    artwork: song.metadata.thumbnail ? [{ src: song.metadata.thumbnail }] : [],
  })
}

let started = false
export function startEngine(controls: { next: () => void; prev: () => void; togglePlay: () => void }) {
  if (started) return
  started = true
  audio = new Audio()
  audio.preload = "auto"
  audio.volume = usePlayerStore.getState().volume / 100

  audio.addEventListener("timeupdate", () => {
    if (audio && !audio.paused && !audio.seeking) {
      // Replaying after the queue ended: begin a fresh session for the same song.
      if (!tracker.current && loadedSongId) tracker.start(loadedSongId, Number.isFinite(audio.duration) ? audio.duration : 0)
      tracker.sample(audio.currentTime)
      savePosition()
    }
    const now = performance.now()
    if (now - lastClock < 250) return
    lastClock = now
    setClockNow()
  })
  audio.addEventListener("loadedmetadata", () => {
    if (audio && Number.isFinite(audio.duration)) tracker.setDuration(audio.duration)
    applyResume()
    setClockNow()
  })
  audio.addEventListener("seeking", () => tracker.break())
  audio.addEventListener("seeked", () => {
    setClockNow()
    savePosition(true)
  })
  audio.addEventListener("playing", () => {
    consecutiveErrors = 0
  })
  audio.addEventListener("ended", () => advance({ auto: true }))
  audio.addEventListener("error", () => {
    if (audio?.getAttribute("src")) onError()
  })
  // Keep store in sync if the OS/media keys pause playback.
  audio.addEventListener("pause", () => {
    tracker.break()
    savePosition(true)
    if (performance.now() < ignorePauseUntil || audio?.ended) return
    if (!usePlayerStore.getState().paused) usePlayerStore.getState().setPaused(true)
  })
  audio.addEventListener("play", () => {
    if (usePlayerStore.getState().paused) usePlayerStore.getState().setPaused(false)
  })

  // Don't lose the current listening session when the window closes.
  window.addEventListener("beforeunload", () => {
    savePosition(true)
    report(tracker.finish())
  })

  usePlayerStore.subscribe((s, p) => {
    if (s.currentUid !== p.currentUid) topUpRadio(s.queue)
    if (s.currentSongId !== loadedSongId || (s.currentUid !== p.currentUid && s.currentSongId === loadedSongId && s.currentUid !== null)) {
      if (s.currentSongId !== loadedSongId) load(s.currentSongId)
      else restartCurrent() // same song, different queue entry (duplicate) → start over
    }
    if (s.restartToken !== p.restartToken) restartCurrent()
    if (s.paused !== p.paused && audio && loadedSongId) {
      if (s.paused) audio.pause()
      else safePlay()
    }
    if (s.volume !== p.volume && audio) audio.volume = s.volume / 100
    if (s.currentlyPlaying !== p.currentlyPlaying) updateMediaSession()
  })

  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", () => controls.togglePlay())
    navigator.mediaSession.setActionHandler("pause", () => controls.togglePlay())
    navigator.mediaSession.setActionHandler("nexttrack", () => controls.next())
    navigator.mediaSession.setActionHandler("previoustrack", () => controls.prev())
    navigator.mediaSession.setActionHandler("seekto", (d) => {
      if (audio && d.seekTime != null) audio.currentTime = d.seekTime
    })
  }
}
