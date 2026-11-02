// Resume long tracks (audiobooks, mixes) where you left off.

/** Only tracks at least this long remember their position. */
export const RESUME_MIN_DURATION_SEC = 10 * 60
/** Stopping in the first few seconds isn't worth resuming. */
const MIN_POSITION_SEC = 10

/** How close to the end counts as "finished" (30 s, or 1% of very long tracks). */
export const endMargin = (durationSec: number) => Math.max(30, durationSec * 0.01)

export const isResumable = (durationSec: number) => durationSec >= RESUME_MIN_DURATION_SEC

/** Position to resume from, or null to start at the beginning. */
export function resumePosition(savedSec: number | null | undefined, durationSec: number): number | null {
  if (!savedSec || !isResumable(durationSec)) return null
  if (savedSec < MIN_POSITION_SEC) return null
  if (savedSec >= durationSec - endMargin(durationSec)) return null // finished (or nearly): start over
  return savedSec
}

/** What to store for a position: a number to save, or null to forget it (start/end of the track). */
export function positionToStore(positionSec: number, durationSec: number): number | null {
  if (!isResumable(durationSec)) return null
  if (positionSec < MIN_POSITION_SEC || positionSec >= durationSec - endMargin(durationSec)) return null
  return Math.floor(positionSec)
}
