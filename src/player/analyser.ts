// Audio analysis for the visualizer. Taps the engine's single <audio> element
// through Web Audio the first time a visualizer needs it; the element keeps
// playing through the AudioContext from then on (a media element can only be
// connected once), so this is created lazily and never torn down.
//
// Sync: the analyser hears audio *before* it comes out of the speakers (by the
// output latency: ~10–40 ms wired, 150 ms+ on Bluetooth). Every frame is
// therefore queued and shown that much later, and beats come from a tempo
// tracker that predicts them (see ./beat) instead of reacting late to them.
import { getAudio, getLoadedSongId } from "./engine"
import { BeatTracker, spectralFlux } from "./beat"
import { cleanGains, EQ_BANDS, eqPreamp, EQ_FLAT } from "@/lib/equalizer"
import { useUserStore } from "@/stores/useUserStore"

export type AudioFrame = {
  /** 0..1 energy per band, volume-independent and smoothed. */
  bass: number
  mid: number
  treble: number
  level: number
  /** 0..1, jumps to 1 on each beat and decays quickly. */
  beat: number
  /** Tempo in bpm once the beat is locked, else null. */
  bpm: number | null
  /** Seconds since the reader started; a clock that only runs while drawing. */
  time: number
  /** Per-bin energy 0..1 (log-spaced, `BINS` long). */
  spectrum: Float32Array
  /** Waveform -1..1 (`WAVE` samples), volume-compensated. */
  wave: Float32Array
  /** The song playing and how far into it you're hearing, in seconds; null while paused. */
  songId: string | null
  position: number | null
}

export const BINS = 96
const WAVE = 512
export const MIN_DB = -95
export const MAX_DB = -15

/** Log-spaced FFT bins for each spectrum bin, ~30 Hz to ~16 kHz so bass isn't squashed into two bars. */
export function spectrumBins(sampleRate: number, fftSize: number): [number, number][] {
  const hzPerBin = sampleRate / fftSize
  const lo = Math.log(30)
  const hi = Math.log(16000)
  return Array.from({ length: BINS }, (_, i) => {
    const a = Math.max(1, Math.floor(Math.exp(lo + ((hi - lo) * i) / BINS) / hzPerBin))
    const b = Math.max(a + 1, Math.floor(Math.exp(lo + ((hi - lo) * (i + 1)) / BINS) / hzPerBin))
    return [a, Math.min(b, fftSize / 2)]
  })
}
/** Where bass ends and mids end, as spectrum bins. */
export const bandEdges = () => [Math.floor(BINS * 0.16), Math.floor(BINS * 0.6)] as const

let ctx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let beatAnalyser: AnalyserNode | null = null
let eqPreampNode: GainNode | null = null
let eqFilters: BiquadFilterNode[] = []
let freq: Float32Array<ArrayBuffer> | null = null
let time: Float32Array<ArrayBuffer> | null = null
let ranges: [number, number][] = []
/** Bumped on seek / new track so readers restart beat tracking. */
let generation = 0

function ensure(): boolean {
  if (analyser) {
    if (ctx?.state === "suspended") void ctx.resume()
    return true
  }
  const audio = getAudio()
  if (!audio) return false
  try {
    ctx = new AudioContext({ latencyHint: "interactive" })
    const src = ctx.createMediaElementSource(audio)
    analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    // Light smoothing for the visuals only; beats use their own unsmoothed analyser.
    analyser.smoothingTimeConstant = 0.5
    analyser.minDecibels = MIN_DB
    analyser.maxDecibels = MAX_DB
    beatAnalyser = ctx.createAnalyser()
    beatAnalyser.fftSize = 1024 // ~23 ms window: tight onset timing
    beatAnalyser.smoothingTimeConstant = 0
    src.connect(analyser)
    src.connect(beatAnalyser)
    // The analysers listen before the equalizer, so changing the sound doesn't change the visuals or the beat.
    eqPreampNode = ctx.createGain()
    eqFilters = EQ_BANDS.map((hz, i) => {
      const filter = ctx!.createBiquadFilter()
      filter.type = i === 0 ? "lowshelf" : i === EQ_BANDS.length - 1 ? "highshelf" : "peaking"
      filter.frequency.value = hz
      filter.Q.value = 1.1
      return filter
    })
    let last: AudioNode = src.connect(eqPreampNode)
    for (const filter of eqFilters) last = last.connect(filter)
    last.connect(ctx.destination)
    applyEqualizer(savedGains())
    // A suspended context would silence the song, now that it plays through this graph.
    audio.addEventListener("play", () => void ctx?.resume())
    freq = new Float32Array(analyser.frequencyBinCount)
    time = new Float32Array(analyser.fftSize)
    ranges = spectrumBins(ctx.sampleRate, analyser.fftSize)
    for (const ev of ["seeked", "loadstart"]) audio.addEventListener(ev, () => generation++)
    if (ctx.state === "suspended") void ctx.resume()
    return true
  } catch (err) {
    console.warn("[visualizer] audio analysis unavailable:", (err as Error).message)
    analyser = null
    return false
  }
}

const savedGains = () => {
  const eq = useUserStore.getState().settings.equalizer
  return eq?.enabled ? cleanGains(eq.gains) : EQ_FLAT
}

/** Glides to the new settings, because jumping would click. */
function applyEqualizer(gains: number[]) {
  if (!ctx || !eqPreampNode) return
  const now = ctx.currentTime
  eqPreampNode.gain.setTargetAtTime(eqPreamp(gains), now, 0.02)
  eqFilters.forEach((filter, i) => filter.gain.setTargetAtTime(gains[i], now, 0.02))
}

/** Hear settings straight away while a slider is moving, before they're saved. */
export function previewEqualizer(gains: number[]) {
  if (ensure()) applyEqualizer(gains)
}

/** Keeps the sound matching the saved settings. The audio only runs through this once it's needed. */
export function installEqualizer() {
  const sync = () => {
    const on = Boolean(useUserStore.getState().settings.equalizer?.enabled)
    if (on ? ensure() : Boolean(ctx)) applyEqualizer(savedGains())
  }
  useUserStore.subscribe((s, p) => {
    if (s.settings.equalizer !== p.settings.equalizer) sync()
  })
  sync()
}

/** Seconds between the analyser seeing audio and it reaching your ears. */
function outputDelay(extraMs: number) {
  if (!ctx) return 0
  const reported = (ctx.outputLatency || 0) + (ctx.baseLatency || 0)
  return Math.max(0, Math.min(1, reported + extraMs / 1000))
}

/**
 * Onsets are detected a little after the hit: the kick has to fill part of the
 * 1024-sample analysis window, and frames are sampled at display rate. Measured
 * at ~30 ms; since the beat grid is predicted, we can show beats that much
 * earlier for free.
 */
const ONSET_LAG = 0.03

type Snapshot = { at: number; bass: number; mid: number; treble: number; spectrum: Float32Array; wave: Float32Array }
const QUEUE = 90 // ~1.5 s at 60 fps: enough for any realistic output delay

/**
 * Reads the current audio into a reusable frame. Call once per animation frame.
 * `offsetMs()` is the user's extra timing nudge (e.g. for Bluetooth headphones).
 */
export function createFrameReader(offsetMs: () => number = () => 0) {
  const frame: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0, beat: 0, bpm: null, time: 0, spectrum: new Float32Array(BINS), wave: new Float32Array(WAVE), songId: null, position: null }
  const queue: Snapshot[] = Array.from({ length: QUEUE }, () => ({ at: -Infinity, bass: 0, mid: 0, treble: 0, spectrum: new Float32Array(BINS), wave: new Float32Array(WAVE) }))
  let head = 0
  let last = performance.now()
  let tracker = new BeatTracker()
  let seenGeneration = generation
  let prevMag: Float32Array | null = null
  let mag: Float32Array | null = null
  let beatBuf: Float32Array<ArrayBuffer> | null = null
  /** Beat times (s, analysis clock) not shown yet. */
  const pendingBeats: number[] = []
  const raw = { bass: 0, mid: 0, treble: 0 }

  const ease = (prev: number, next: number, up: number, down: number) => prev + (next - prev) * (next > prev ? up : down)
  const band = (s: Float32Array, from: number, to: number) => {
    let sum = 0
    for (let i = from; i < to; i++) sum += s[i]
    return sum / (to - from)
  }

  /** Analyse "now" into the newest queue slot; also feeds the beat tracker. */
  function analyse(now: number, audio: HTMLAudioElement) {
    const slot = queue[head]
    head = (head + 1) % QUEUE
    slot.at = now
    analyser!.getFloatFrequencyData(freq!)
    analyser!.getFloatTimeDomainData(time!)
    // The element's volume is applied before the analyser: undo it so quiet playback still looks alive.
    const vol = Math.max(0.03, audio.volume)
    const boostDb = -20 * Math.log10(vol)
    const minDb = analyser!.minDecibels
    const span = analyser!.maxDecibels - minDb
    for (let i = 0; i < BINS; i++) {
      const [a, b] = ranges[i]
      let peak = -Infinity
      for (let j = a; j < b; j++) if (freq![j] > peak) peak = freq![j]
      const v = Math.min(1, Math.max(0, (peak + boostDb - minDb) / span))
      // Gentle tilt: highs are naturally quieter, lift them so the whole spectrum moves.
      slot.spectrum[i] = Math.min(1, v * (0.85 + (0.35 * i) / BINS))
    }
    const step = time!.length / WAVE
    const gain = Math.min(8, 1 / vol)
    for (let i = 0; i < WAVE; i++) slot.wave[i] = Math.max(-1, Math.min(1, time![Math.floor(i * step)] * gain))
    const [bassEnd, midEnd] = bandEdges()
    slot.bass = band(slot.spectrum, 0, bassEnd)
    slot.mid = band(slot.spectrum, bassEnd, midEnd)
    slot.treble = band(slot.spectrum, midEnd, BINS)

    // Beat: spectral flux of the unsmoothed analyser, weighted toward kick drums
    // (~40–150 Hz) with some low-mid (snares) so beat-light music still tracks.
    const n = beatAnalyser!.frequencyBinCount
    if (!beatBuf || beatBuf.length !== n) {
      beatBuf = new Float32Array(n)
      mag = new Float32Array(n)
      prevMag = new Float32Array(n)
    }
    beatAnalyser!.getFloatFrequencyData(beatBuf)
    for (let i = 0; i < n; i++) mag![i] = Math.pow(10, (beatBuf[i] + boostDb) / 20)
    const hz = ctx!.sampleRate / beatAnalyser!.fftSize
    const kick = spectralFlux(prevMag!, mag!, Math.max(1, Math.round(40 / hz)), Math.round(150 / hz) + 1)
    const body = spectralFlux(prevMag!, mag!, Math.round(150 / hz) + 1, Math.round(2500 / hz))
    ;[prevMag, mag] = [mag, prevMag]
    const e = tracker.update(kick + body * 0.35, now)
    if (e) pendingBeats.push(e.at - ONSET_LAG)
  }

  return function read(): AudioFrame {
    const nowMs = performance.now()
    const dt = Math.min(0.1, (nowMs - last) / 1000)
    last = nowMs
    const now = nowMs / 1000
    frame.time += dt
    const audio = getAudio()
    const playing = ensure() && analyser && audio && !audio.paused
    if (seenGeneration !== generation) {
      // Seek or new song: the old tempo and queued frames no longer apply.
      seenGeneration = generation
      tracker = new BeatTracker()
      pendingBeats.length = 0
      for (const s of queue) s.at = -Infinity
      prevMag?.fill(0)
    }

    if (playing && audio) analyse(now, audio)
    // Show the newest snapshot that has reached the speakers by now.
    const delay = outputDelay(offsetMs())
    let shown: Snapshot | null = null
    for (let k = 1; k <= QUEUE; k++) {
      const s = queue[(head - k + QUEUE) % QUEUE]
      if (s.at === -Infinity) break
      if (s.at <= now - delay) {
        shown = s
        break
      }
    }
    if (!playing || !shown) {
      // Silence: let everything settle gently instead of freezing.
      const k = Math.pow(0.04, dt)
      raw.bass *= k
      raw.mid *= k
      raw.treble *= k
      for (let i = 0; i < BINS; i++) frame.spectrum[i] *= k
      for (let i = 0; i < WAVE; i++) frame.wave[i] *= k
    } else {
      frame.spectrum.set(shown.spectrum)
      frame.wave.set(shown.wave)
      raw.bass = shown.bass
      raw.mid = shown.mid
      raw.treble = shown.treble
    }
    frame.bass = ease(frame.bass, raw.bass, 0.6, 0.15)
    frame.mid = ease(frame.mid, raw.mid, 0.5, 0.12)
    frame.treble = ease(frame.treble, raw.treble, 0.5, 0.12)
    frame.level = (frame.bass + frame.mid + frame.treble) / 3

    // A beat shows once it has reached the speakers, too.
    let hit = false
    while (pendingBeats.length && pendingBeats[0] + delay <= now) {
      pendingBeats.shift()
      hit = true
    }
    frame.beat = hit && playing ? 1 : frame.beat * Math.pow(0.02, dt)
    frame.bpm = tracker.locked ? tracker.bpm : null
    frame.songId = playing ? getLoadedSongId() : null
    frame.position = playing && audio ? audio.currentTime - delay : null
    return frame
  }
}
