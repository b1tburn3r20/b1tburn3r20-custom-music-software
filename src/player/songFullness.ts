// Scans a whole song ahead of time for how full it sounds at each moment. Since the
// song is a file, a scene can read this ahead of what's playing, and judge each moment
// with the audio on both sides of it and the song's real peak, none of which live
// analysis can know. Only scanned when a scene asks, and kept for recent songs.
import { BINS, MAX_DB, MIN_DB, bandEdges, spectrumBins } from "./analyser"
import { getAudio } from "./engine"

const HOP_SECONDS = 1 / 30
const FFT_SIZE = 2048
const SAMPLE_RATE = 44100
/** Decoding a whole file takes memory: longer than this (a mix, a 10-hour loop) isn't scanned. */
const MAX_SONG_SECONDS = 20 * 60
const KEEP_SONGS = 40

/** How far below the song's fullest counts as nothing. */
const RANGE = 0.15
/** Anything shorter than this, like a drum hit, is ignored. */
const IGNORE_SHORTER_THAN_SECONDS = 0.2
/** A peak must hold for about this long to set the song's mark. */
const SUSTAIN_SECONDS = 5
/** How far ahead a coming peak affects how the present is judged. */
const LOOK_AHEAD_SECONDS = 20
/** About how full a typical full mix gets. */
const TYPICAL_PEAK = 0.63
const FORGET_TYPICAL_SECONDS = 150
/** At most this share of a song counts as its most intense moments. */
const PEAK_SHARE = 0.06
const PEAK_MIN_FULLNESS = 0.9
/** Peak moments this close together count as one. */
const PEAK_JOIN_SECONDS = 0.6
/** A peak moment shorter than this is dropped. */
const PEAK_LEAST_SECONDS = 0.4

/** Overall level (0..1) of each hop, on the same scale as the live analyser's bands. */
export async function levelsFromSamples(samples: Float32Array, sampleRate: number, hopSeconds: number, pause: () => Promise<void> = async () => {}): Promise<Float32Array> {
  const n = FFT_SIZE
  const hop = Math.max(1, Math.round(hopSeconds * sampleRate))
  const count = Math.max(0, Math.floor((samples.length - n) / hop) + 1)
  const out = new Float32Array(count)
  // Same analysis as an AnalyserNode: a Blackman window, then magnitudes scaled by 1/n.
  const window = new Float32Array(n)
  for (let i = 0; i < n; i++) window[i] = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / n) + 0.08 * Math.cos((4 * Math.PI * i) / n)
  const bits = Math.log2(n)
  const reversed = new Uint16Array(n)
  for (let i = 0; i < n; i++) {
    let r = 0
    for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b)
    reversed[i] = r
  }
  const cos = new Float32Array(n / 2)
  const sin = new Float32Array(n / 2)
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n)
    sin[i] = -Math.sin((2 * Math.PI * i) / n)
  }
  const re = new Float32Array(n)
  const im = new Float32Array(n)
  const smoothed = new Float32Array(n / 2)
  const bins = spectrumBins(sampleRate, n)
  const edges = bandEdges()
  // The live analyser smooths by half on each of about two calls per hop.
  const keep = Math.pow(0.5, hopSeconds * 60)
  const spectrum = new Float32Array(BINS)
  const band = (from: number, to: number) => {
    let sum = 0
    for (let i = from; i < to; i++) sum += spectrum[i]
    return sum / (to - from)
  }
  for (let f = 0; f < count; f++) {
    const start = f * hop
    for (let i = 0; i < n; i++) {
      re[reversed[i]] = samples[start + i] * window[i]
      im[i] = 0
    }
    for (let size = 2; size <= n; size *= 2) {
      const half = size / 2
      const step = n / size
      for (let i = 0; i < n; i += size) {
        for (let j = 0; j < half; j++) {
          const a = i + j
          const b = a + half
          const c = cos[j * step]
          const s = sin[j * step]
          const tr = re[b] * c - im[b] * s
          const ti = re[b] * s + im[b] * c
          re[b] = re[a] - tr
          im[b] = im[a] - ti
          re[a] += tr
          im[a] += ti
        }
      }
    }
    for (let i = 0; i < n / 2; i++) smoothed[i] = keep * smoothed[i] + (1 - keep) * (Math.hypot(re[i], im[i]) / n)
    for (let i = 0; i < BINS; i++) {
      const [a, b] = bins[i]
      let peak = 0
      for (let j = a; j < b; j++) if (smoothed[j] > peak) peak = smoothed[j]
      const db = peak > 0 ? 20 * Math.log10(peak) : -Infinity
      const v = Math.min(1, Math.max(0, (db - MIN_DB) / (MAX_DB - MIN_DB)))
      spectrum[i] = Math.min(1, v * (0.85 + (0.35 * i) / BINS))
    }
    out[f] = (band(0, edges[0]) + band(edges[0], edges[1]) + band(edges[1], BINS)) / 3
    if (f % 50 === 49) await pause() // about 4 ms of work at a time, so drawing never stutters
  }
  return out
}

/** Removes spikes (lowest nearby, then highest nearby) and dips (the reverse). Longer stretches keep their exact edges. */
function steadyLevels(levels: Float32Array, hopSeconds: number): Float32Array {
  const radius = Math.max(1, Math.round(IGNORE_SHORTER_THAN_SECONDS / hopSeconds / 2))
  const slide = (from: Float32Array, pick: (a: number, b: number) => number) => {
    const to = new Float32Array(from.length)
    for (let i = 0; i < from.length; i++) {
      let v = from[i]
      for (let k = Math.max(0, i - radius); k <= Math.min(from.length - 1, i + radius); k++) v = pick(v, from[k])
      to[i] = v
    }
    return to
  }
  return slide(slide(slide(slide(levels, Math.min), Math.max), Math.max), Math.min)
}

/**
 * The song's few most intense moments, as 1s among 0s: the loudest stretches of the whole
 * song, and only while it's also near its fullest. Near-together moments join up, and
 * blips are dropped, so each one reads as an event.
 */
export function peakMoments(levels: Float32Array, fullness: Float32Array, hopSeconds: number): Uint8Array {
  const n = levels.length
  const out = new Uint8Array(n)
  if (!n) return out
  const steady = steadyLevels(levels, hopSeconds)
  const cutoff = Float32Array.from(steady).sort()[Math.min(n - 1, Math.floor(n * (1 - PEAK_SHARE)))]
  for (let i = 0; i < n; i++) if (steady[i] > cutoff && fullness[i] >= PEAK_MIN_FULLNESS) out[i] = 1 // strictly above, so ties can't mark a whole chorus
  const join = Math.round(PEAK_JOIN_SECONDS / hopSeconds)
  const least = Math.round(PEAK_LEAST_SECONDS / hopSeconds)
  let last = -1
  for (let i = 0; i < n; i++) {
    if (!out[i]) continue
    if (last >= 0 && i - last <= join) out.fill(1, last, i)
    last = i
  }
  for (let i = 0; i < n; ) {
    if (!out[i]) {
      i++
      continue
    }
    let end = i
    while (end < n && out[end]) end++
    if (end - i < least) out.fill(0, i, end)
    i = end
  }
  return out
}

/**
 * Levels → how close each moment is to the fullest it needs to be judged against, 0..1.
 * Knowing the whole song lets this remove short spikes and dips without moving when a
 * section starts or ends. Each moment is judged against the song's peak so far and what's
 * coming soon, not its final peak: a huge ending shouldn't make the rest look small.
 */
export function fullnessCurve(levels: Float32Array, hopSeconds: number): Float32Array {
  const steady = steadyLevels(levels, hopSeconds)
  const n = levels.length
  const sustained = new Float32Array(n)
  const keep = Math.exp(-hopSeconds / SUSTAIN_SECONDS)
  let running = 0
  let peak = 0
  for (let i = 0; i < n; i++) {
    running = keep * running + (1 - keep) * steady[i]
    sustained[i] = running
    if (running > peak) peak = running
  }
  const out = new Float32Array(n)
  if (peak <= 0) return out
  // The highest of the next stretch, found by walking backward and keeping only values that can still win.
  const look = Math.round(LOOK_AHEAD_SECONDS / hopSeconds)
  const ahead = new Float32Array(n)
  const candidates: number[] = []
  let first = 0
  for (let i = n - 1; i >= 0; i--) {
    while (candidates.length > first && sustained[candidates[candidates.length - 1]] <= sustained[i]) candidates.pop()
    candidates.push(i)
    if (candidates[first] > i + look) first++
    ahead[i] = sustained[candidates[first]]
  }
  let soFar = 0
  for (let i = 0; i < n; i++) {
    if (sustained[i] > soFar) soFar = sustained[i]
    // Until the song has shown its range, a typical full mix stands in. That fades for songs that never get so big.
    const known = Math.max(soFar, ahead[i])
    const mark = known + Math.max(0, TYPICAL_PEAK - known) * Math.exp((-i * hopSeconds) / FORGET_TYPICAL_SECONDS)
    out[i] = Math.min(1, Math.max(0, (steady[i] - (mark - RANGE)) / RANGE))
  }
  return out
}

type Scan = { fullness: Float32Array; peaks: Uint8Array }
const scans = new Map<string, Scan | null>() // null: can't be scanned, don't try again
let scanning: string | null = null

async function scan(songId: string) {
  scanning = songId
  let result: Scan | null = null
  try {
    const file = await fetch(`media://song/${encodeURIComponent(songId)}`)
    const decoded = await new OfflineAudioContext(1, 1, SAMPLE_RATE).decodeAudioData(await file.arrayBuffer())
    const mono = new Float32Array(decoded.length)
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const channel = decoded.getChannelData(c)
      for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / decoded.numberOfChannels
    }
    const levels = await levelsFromSamples(mono, SAMPLE_RATE, HOP_SECONDS, () => new Promise((done) => setTimeout(done)))
    const fullness = fullnessCurve(levels, HOP_SECONDS)
    result = { fullness, peaks: peakMoments(levels, fullness, HOP_SECONDS) }
  } catch (err) {
    console.warn("[visualizer] couldn't scan song:", (err as Error).message)
  }
  if (scans.size >= KEEP_SONGS) scans.delete(scans.keys().next().value as string)
  scans.set(songId, result)
  scanning = null
}

/** How full the song is at `seconds`, 0..1; null until it's scanned, or if it can't be. */
export function songFullness(songId: string, seconds: number): number | null {
  const scanned = scans.get(songId)
  if (scanned === undefined) {
    const duration = getAudio()?.duration ?? 0
    if (duration > MAX_SONG_SECONDS) scans.set(songId, null)
    else if (!scanning && duration > 0) void scan(songId)
    return null
  }
  const curve = scanned?.fullness
  if (!curve || !curve.length) return null
  const at = Math.max(0, Math.min(curve.length - 1, seconds / HOP_SECONDS))
  const i = Math.floor(at)
  const next = Math.min(curve.length - 1, i + 1)
  return curve[i] + (curve[next] - curve[i]) * (at - i)
}

/** Whether `seconds` is one of the song's few most intense moments. False until it's scanned. */
export function songPeak(songId: string, seconds: number): boolean {
  const peaks = scans.get(songId)?.peaks
  if (!peaks || !peaks.length) return false
  return peaks[Math.max(0, Math.min(peaks.length - 1, Math.floor(seconds / HOP_SECONDS)))] === 1
}
