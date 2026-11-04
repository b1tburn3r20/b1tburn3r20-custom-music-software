// Measures how long a song was actually listened to. Pure (no audio/DOM) so
// the rules are unit tested; the engine feeds it currentTime samples.

/** A play counts once you've listened to min(30 s, 50% of the track). */
export const COUNT_AFTER_MS = 30_000
export function countsAsPlay(listenedMs: number, durationSec: number): boolean {
  const half = durationSec > 0 ? (durationSec * 1000) / 2 : COUNT_AFTER_MS
  return listenedMs >= Math.min(COUNT_AFTER_MS, half)
}

/** Largest jump between samples still treated as continuous playback (timeupdate fires ~4×/s). */
const MAX_STEP_SEC = 1.5

export type ListenSession = { songId: string; startedAt: number; listenedMs: number; durationSec: number }

export class ListenTracker {
  private session: ListenSession | null = null
  private lastPos: number | null = null

  start(songId: string, durationSec: number, now = Date.now()) {
    const prev = this.finish(now)
    this.session = { songId, startedAt: now, listenedMs: 0, durationSec }
    this.lastPos = null
    return prev
  }

  setDuration(durationSec: number) {
    if (this.session && durationSec > 0) this.session.durationSec = durationSec
  }

  /** Feed the current playback position while playing. Seeks (jumps) and backwards moves add nothing. */
  sample(positionSec: number) {
    if (!this.session) return
    if (this.lastPos !== null) {
      const step = positionSec - this.lastPos
      if (step > 0 && step <= MAX_STEP_SEC) this.session.listenedMs += step * 1000
    }
    this.lastPos = positionSec
  }

  /** Paused/seeked: the next sample starts a new continuous stretch. */
  break() {
    this.lastPos = null
  }

  /** Repeat-one restart of the same song: close this session and start a fresh one. */
  restart(now = Date.now()) {
    if (!this.session) return null
    const { songId, durationSec } = this.session
    return this.start(songId, durationSec, now)
  }

  finish(now = Date.now()): (ListenSession & { endedAt: number; counted: boolean }) | null {
    const s = this.session
    this.session = null
    this.lastPos = null
    if (!s) return null
    return { ...s, listenedMs: Math.round(s.listenedMs), endedAt: now, counted: countsAsPlay(s.listenedMs, s.durationSec) }
  }

  get current() {
    return this.session
  }
}
