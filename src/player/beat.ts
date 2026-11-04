// Beat tracking for the visualizer: onset detection + tempo estimation + a
// fitted beat grid. Pure (no Web Audio) so it can be unit tested.
//
// Why not just "flash when the bass is loud": detections always arrive a bit
// late and miss soft beats, so pulses drift off the music. Instead we learn the
// tempo and phase from recent onsets and fire on the *predicted* beat times.
// Once locked, pulses land on the beat, even through quiet bars, with no
// detection lag.

/** Spectral flux: how much energy rose since the last spectrum (only increases count). */
export function spectralFlux(prev: Float32Array, cur: Float32Array, from: number, to: number): number {
  let sum = 0
  for (let i = from; i < to; i++) {
    const d = cur[i] - prev[i]
    if (d > 0) sum += d
  }
  return sum / Math.max(1, to - from)
}

const MIN_PERIOD = 60 / 190 // fastest tempo we lock to
const MAX_PERIOD = 60 / 70 // slowest; anything outside is folded by 2x into range
const WINDOW = 1.5 // seconds of flux history for the adaptive threshold
const ONSET_MEMORY = 8 // seconds of onsets used for the grid
// Confidence to start following the grid, and to keep following it. Measured:
// steady rhythms score ≥ 0.8, random hits rarely exceed 0.7 (see beat.test.ts).
const LOCK_IN = 0.75
const LOCK_HOLD = 0.65

export type BeatEvent = { at: number; onGrid: boolean }
type Onset = { t: number; w: number }

export class BeatTracker {
  private hist: { t: number; v: number }[] = []
  private onsets: Onset[] = []
  private lastOnset = -Infinity
  private above = false
  /** Beat period in seconds. */
  period: number | null = null
  /** How well recent onsets (weighted by strength) sit on the fitted grid, 0..1. */
  confidence = 0
  /** A time on the beat grid; beats are at anchor + n * period. */
  private anchor: number | null = null
  private lastFired = -Infinity
  /** Consecutive fits that agreed on the tempo; a lock needs two. */
  private agreed = 0

  get bpm() {
    return this.period ? 60 / this.period : null
  }

  private isLocked = false
  get locked() {
    return this.isLocked
  }

  /**
   * Feed one flux value measured at time `t` (seconds, monotonic). Returns the
   * beat to show this frame, if any. `onGrid` is false while the tempo isn't
   * locked and we're reacting to raw onsets instead.
   */
  update(flux: number, t: number): BeatEvent | null {
    const onset = this.detectOnset(flux, t)
    if (onset) {
      this.onsets.push(onset)
      while (this.onsets.length && this.onsets[0].t < t - ONSET_MEMORY) this.onsets.shift()
      this.fitGrid()
    }
    if (!this.locked) {
      if (!onset) return null
      this.lastFired = onset.t
      return { at: onset.t, onGrid: false }
    }
    // Fire on the frame that crosses a grid beat. Guard against double-firing
    // when a refit nudges the grid slightly backwards.
    const p = this.period!
    const at = this.anchor! + Math.floor((t - this.anchor!) / p) * p
    if (at > this.lastFired + p * 0.5 && t - at < 0.1) {
      this.lastFired = at
      return { at, onGrid: true }
    }
    return null
  }

  private detectOnset(flux: number, t: number): Onset | null {
    this.hist.push({ t, v: flux })
    while (this.hist.length && this.hist[0].t < t - WINDOW) this.hist.shift()
    let mean = 0
    for (const h of this.hist) mean += h.v
    mean /= this.hist.length
    let varc = 0
    for (const h of this.hist) varc += (h.v - mean) ** 2
    const std = Math.sqrt(varc / this.hist.length)
    const threshold = mean + Math.max(std * 1.5, mean * 0.5, 1e-4)
    const isAbove = flux > threshold
    // Rising edge only, with a short refractory time (fastest: 1/16 notes at ~190 bpm).
    const fired = isAbove && !this.above && t - this.lastOnset > 0.1
    this.above = isAbove
    if (!fired) return null
    this.lastOnset = t
    // Strength relative to the threshold: kicks outweigh hats, so the grid follows the kicks.
    return { t, w: Math.min(4, flux / threshold) }
  }

  /** Coarse period from a histogram of inter-onset intervals (nearby pairs, folded into range). */
  private coarsePeriod(): number | null {
    const o = this.onsets
    const BIN = 0.01
    const bins = new Map<number, number>()
    for (let i = 0; i < o.length; i++) {
      for (let j = i + 1; j < o.length && j <= i + 4; j++) {
        let d = o[j].t - o[i].t
        while (d > MAX_PERIOD) d /= 2
        while (d < MIN_PERIOD) d *= 2
        if (d > MAX_PERIOD) continue
        // Strong pairs close together are the best evidence.
        const w = (o[i].w * o[j].w) / (j - i)
        const k = Math.round(d / BIN)
        for (const [dk, f] of [[-1, 0.5], [0, 1], [1, 0.5]] as const) bins.set(k + dk, (bins.get(k + dk) ?? 0) + w * f)
      }
    }
    let best = -1
    let bestW = 0
    for (const [k, w] of bins) if (w > bestW) [best, bestW] = [k, w]
    return best < 0 ? null : best * BIN
  }

  /** Weighted least-squares fit of onset time vs. beat number, starting from period p and anchor a. */
  private refine(p: number, a: number) {
    for (let pass = 0; pass < 2; pass++) {
      let n = 0, sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0
      for (const { t, w } of this.onsets) {
        const k = Math.round((t - a) / p)
        if (Math.abs(t - (a + k * p)) > p * 0.15) continue
        n++
        sw += w
        sx += w * k
        sy += w * t
        sxx += w * k * k
        sxy += w * k * t
      }
      const den = sw * sxx - sx * sx
      if (n < 3 || den <= 0) break
      const slope = (sw * sxy - sx * sy) / den
      if (slope < MIN_PERIOD * 0.9 || slope > MAX_PERIOD * 1.1) break
      p = slope
      a = (sy - p * sx) / sw
    }
    return { period: p, anchor: a, score: this.score(p, a) }
  }

  /**
   * Share of onset weight tightly on the grid. Off-beats (hats/snares halfway
   * between beats) are normal music, so they only count half against it.
   */
  private score(p: number, a: number) {
    let on = 0
    let off = 0
    let total = 0
    for (const { t, w } of this.onsets) {
      const ph = ((((t - a) / p) % 1) + 1) % 1
      total += w
      if (Math.min(ph, 1 - ph) < 0.07) on += w
      else if (Math.abs(ph - 0.5) < 0.07) off += w
    }
    return on / Math.max(1e-9, total - off * 0.5)
  }

  /**
   * Fit the beat grid to recent onsets. Detections are quantized to animation
   * frames, so summing intervals would drift; a least-squares fit over many
   * onsets averages that jitter out and can't drift.
   */
  private fitGrid() {
    const o = this.onsets
    if (o.length < 6) {
      // With only a handful of hits, almost anything fits some tempo.
      this.confidence = 0
      this.agreed = 0
      this.isLocked = false
      return
    }
    const periods = [this.period, this.coarsePeriod()].filter((x): x is number => x !== null)
    // Try anchoring on each of the last few onsets: the strongest consistent set wins
    // (so a grid started on a hi-hat loses to the one on the kicks).
    let best: ReturnType<BeatTracker["refine"]> | null = null
    for (const p0 of periods) {
      for (let i = Math.max(0, o.length - 4); i < o.length; i++) {
        const fit = this.refine(p0, o[i].t)
        if (!best || fit.score > best.score) best = fit
      }
    }
    if (!best) return
    const sameTempo = this.period !== null && Math.abs(best.period - this.period) < 0.02
    this.agreed = sameTempo ? this.agreed + 1 : 1
    this.period = best.period
    this.anchor = best.anchor
    this.confidence = best.score
    this.isLocked = this.isLocked ? this.confidence >= LOCK_HOLD : this.confidence >= LOCK_IN && this.agreed >= 2
  }
}
