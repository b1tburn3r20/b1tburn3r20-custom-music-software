import { describe, expect, it } from "vitest"
import { BeatTracker } from "./beat"

/** Simulates a 60 fps flux signal: noise floor plus a kick spike on every beat. */
function run(opts: { bpm: number; seconds: number; skip?: (beat: number) => boolean; jitter?: number; offbeats?: boolean; seed?: number }) {
  let seed = opts.seed ?? 1
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const period = 60 / opts.bpm
  const tracker = new BeatTracker()
  const fired: { at: number; onGrid: boolean }[] = []
  const dt = 1 / 60
  const kicks: number[] = []
  for (let b = 0; b * period < opts.seconds; b++) if (!opts.skip?.(b)) kicks.push(b * period + (rand() - 0.5) * (opts.jitter ?? 0))
  let k = 0
  for (let t = 0; t < opts.seconds; t += dt) {
    let flux = 0.02 + rand() * 0.02
    while (k < kicks.length && kicks[k] < t) {
      if (t - kicks[k] < dt) flux += 1
      k++
    }
    if (opts.offbeats && Math.abs(((t + period / 2) % period) - 0) < dt) flux += 0.35
    const e = tracker.update(flux, t)
    if (e) fired.push(e)
  }
  return { tracker, fired, period }
}

/** Distance from `t` to the nearest true beat. */
const offGrid = (t: number, period: number) => {
  const e = t % period
  return Math.min(e, period - e)
}

describe("BeatTracker", () => {
  it.each([90, 120, 128, 174])("locks onto %i bpm and fires on the beat", (bpm) => {
    const { tracker, fired, period } = run({ bpm, seconds: 20, jitter: 0.01 })
    expect(tracker.bpm).not.toBeNull()
    expect(Math.abs(tracker.bpm! - bpm)).toBeLessThan(2)
    const late = fired.filter((e) => e.at > 8)
    expect(late.every((e) => e.onGrid)).toBe(true)
    // Within ~1.5 frames of the real beat, and roughly one pulse per beat.
    for (const e of late) expect(offGrid(e.at, period)).toBeLessThan(0.026)
    expect(late.length).toBeGreaterThan((12 / period) * 0.9)
    expect(late.length).toBeLessThan((12 / period) * 1.1)
  })

  it("keeps pulsing through missing kicks once locked", () => {
    const { fired, period } = run({ bpm: 120, seconds: 20, skip: (b) => b >= 20 && b < 28 })
    const gap = fired.filter((e) => e.at >= 10.1 && e.at < 13.9)
    expect(gap.length).toBeGreaterThanOrEqual(7)
    for (const e of gap) expect(offGrid(e.at, period)).toBeLessThan(0.03)
  })

  it("isn't thrown off by quieter off-beats (hi-hats/snares between kicks)", () => {
    const { tracker, fired, period } = run({ bpm: 100, seconds: 20, offbeats: true })
    expect(Math.abs(tracker.bpm! - 100)).toBeLessThan(2)
    // Pulses land on the kicks, not on the off-beats.
    for (const e of fired.filter((x) => x.at > 8)) expect(offGrid(e.at, period)).toBeLessThan(0.026)
  })

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])("doesn't claim a tempo for random hits (seed %i)", (s) => {
    let seed = s * 7919
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const tracker = new BeatTracker()
    let grid = 0
    let next = 0
    for (let t = 0; t < 20; t += 1 / 60) {
      let flux = 0.02 + rand() * 0.02
      if (t >= next) {
        flux += 1
        next = t + 0.2 + rand() * 0.9
      }
      if (tracker.update(flux, t)?.onGrid) grid++
    }
    expect(grid).toBeLessThan(10)
  })
})
