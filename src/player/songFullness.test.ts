import { describe, expect, it } from "vitest"
import { fullnessCurve, levelsFromSamples, peakMoments } from "./songFullness"

const HOP = 1 / 30
/** Sections of [level, seconds]. */
const song = (...sections: [number, number][]) => {
  const out: number[] = []
  for (const [level, seconds] of sections) for (let i = 0; i < seconds / HOP; i++) out.push(level)
  return Float32Array.from(out)
}
const frame = (seconds: number) => Math.round(seconds / HOP)

describe("fullnessCurve", () => {
  it("marks a section's start and end to within a frame", () => {
    const c = fullnessCurve(song([0.4, 20], [0.63, 20], [0.4, 20]), HOP)
    expect(c[frame(20) - 2]).toBe(0)
    expect(c[frame(20) + 1]).toBeGreaterThan(0.9)
    expect(c[frame(40) - 2]).toBeGreaterThan(0.9)
    expect(c[frame(40) + 1]).toBe(0)
  })

  it("ignores drum hits, even very big ones", () => {
    const levels = song([0.4, 60])
    for (let i = 0; i < levels.length; i += 15) levels[i] = levels[i + 1] = levels[i + 2] = 0.8
    const withPeak = Float32Array.from([...levels, ...song([0.63, 30])])
    expect(Math.max(...fullnessCurve(withPeak, HOP).slice(frame(1), frame(59)))).toBe(0)
  })

  it("sees a peak coming, so what leads up to it stays low", () => {
    const c = fullnessCurve(song([0.6, 10], [0.75, 30]), HOP)
    expect(c[frame(5)]).toBeLessThan(0.2)
    expect(c[frame(30)]).toBeGreaterThan(0.9)
  })

  it("doesn't let a huge ending make the rest of the song look small", () => {
    const c = fullnessCurve(song([0.63, 180], [0.8, 30]), HOP)
    expect(c[frame(60)]).toBeGreaterThan(0.9)
    expect(c[frame(195)]).toBeGreaterThan(0.9)
  })

  it("doesn't treat a loud song's long quiet opening as its peak", () => {
    expect(fullnessCurve(song([0.4, 120], [0.65, 60]), HOP)[frame(30)]).toBe(0)
  })

  it("ignores brief dips inside a chorus", () => {
    const levels = song([0.63, 60])
    for (let i = 0; i < levels.length; i += 15) levels[i] = levels[i + 1] = 0.45
    expect(Math.min(...fullnessCurve(levels, HOP).slice(frame(10), frame(50)))).toBeGreaterThan(0.9)
  })

  it("lets a quiet song reach full at its own peak, once it's had time", () => {
    expect(fullnessCurve(song([0.3, 240], [0.45, 60]), HOP)[frame(280)]).toBeGreaterThan(0.75)
  })

  it("isn't thrown off by a short burst above the real peak", () => {
    expect(fullnessCurve(song([0.63, 30], [0.9, 0.1], [0.63, 30]), HOP)[frame(50)]).toBeGreaterThan(0.95)
  })

  it("reads nothing from a silent file", () => {
    expect(Math.max(...fullnessCurve(song([0, 5]), HOP))).toBe(0)
  })
})

describe("peakMoments", () => {
  const peaks = (levels: Float32Array) => peakMoments(levels, fullnessCurve(levels, HOP), HOP)
  const share = (p: Uint8Array) => p.reduce((a, b) => a + b, 0) / p.length

  it("marks only the song's most intense stretch, not the whole chorus", () => {
    const p = peaks(song([0.4, 60], [0.63, 60], [0.68, 8], [0.63, 60], [0.4, 12]))
    expect(p[frame(30)]).toBe(0)
    expect(p[frame(90)]).toBe(0)
    expect(p[frame(124)]).toBe(1)
  })

  it("never marks more than a small share of a song", () => {
    const levels = song([0.4, 60], [0.63, 120], [0.4, 60])
    for (let i = 0; i < levels.length; i++) levels[i] += Math.sin(i / 40) * 0.01
    expect(share(peaks(levels))).toBeLessThan(0.08)
  })

  it("ignores loud moments in a song that isn't near its fullest then", () => {
    const levels = song([0.3, 200])
    expect(share(peakMoments(levels, new Float32Array(levels.length), HOP))).toBe(0)
  })

  it("joins moments that are close together", () => {
    const levels = song([0.4, 60], [0.68, 3], [0.6, 0.4], [0.68, 3], [0.4, 60])
    const p = peaks(levels)
    expect(Math.min(...p.slice(frame(60.5), frame(66)))).toBe(1)
  })

  it("drops a blip too short to read", () => {
    const fullness = new Float32Array(frame(60)).fill(1)
    const levels = song([0.4, 30], [0.7, 0.3], [0.4, 29.7])
    expect(share(peakMoments(levels, fullness, HOP))).toBe(0)
  })

  it("finds nothing in silence", () => {
    expect(share(peaks(song([0, 30])))).toBe(0)
  })
})

describe("levelsFromSamples", () => {
  const RATE = 44100
  const tone = (amplitude: number, seconds = 1) => Float32Array.from({ length: RATE * seconds }, (_, i) => amplitude * Math.sin((2 * Math.PI * 1000 * i) / RATE))

  it("gets louder with louder audio", async () => {
    const quiet = await levelsFromSamples(tone(0.02), RATE, HOP)
    const loud = await levelsFromSamples(tone(0.5), RATE, HOP)
    expect(loud[loud.length - 1]).toBeGreaterThan(quiet[quiet.length - 1])
  })

  it("reads silence as nothing", async () => {
    const levels = await levelsFromSamples(new Float32Array(RATE), RATE, HOP)
    expect(Math.max(...levels)).toBe(0)
  })

  it("makes one reading per hop", async () => {
    const levels = await levelsFromSamples(new Float32Array(RATE), RATE, HOP)
    expect(levels.length).toBe(Math.floor((RATE - 2048) / Math.round(HOP * RATE)) + 1)
  })
})
