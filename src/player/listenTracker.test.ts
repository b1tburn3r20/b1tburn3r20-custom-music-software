import { describe, expect, it } from "vitest"
import { ListenTracker, countsAsPlay } from "./listenTracker"

describe("countsAsPlay", () => {
  it("counts after 30 s, or half of a short track", () => {
    expect(countsAsPlay(29_999, 240)).toBe(false)
    expect(countsAsPlay(30_000, 240)).toBe(true)
    expect(countsAsPlay(10_000, 20)).toBe(true) // 50% of a 20 s track
    expect(countsAsPlay(9_000, 20)).toBe(false)
    expect(countsAsPlay(30_000, 0)).toBe(true) // unknown duration → 30 s rule
  })
})

describe("ListenTracker", () => {
  const play = (t: ListenTracker, from: number, to: number, step = 0.25) => {
    for (let p = from; p <= to + 1e-9; p += step) t.sample(p)
  }
  it("accumulates continuous playback", () => {
    const t = new ListenTracker()
    t.start("a", 200, 0)
    play(t, 0, 40)
    const s = t.finish(1)!
    expect(s.listenedMs).toBe(40_000)
    expect(s.counted).toBe(true)
  })
  it("ignores seeks forward and backward", () => {
    const t = new ListenTracker()
    t.start("a", 200, 0)
    play(t, 0, 10)
    t.sample(150) // seek forward: not listened
    play(t, 150, 155)
    t.sample(20) // seek back
    play(t, 20, 25)
    expect(t.finish()!.listenedMs).toBe(20_000)
  })
  it("doesn't count paused time", () => {
    const t = new ListenTracker()
    t.start("a", 200, 0)
    play(t, 0, 5)
    t.break() // paused for a long time at 5 s
    play(t, 5, 10)
    expect(t.finish()!.listenedMs).toBe(10_000)
  })
  it("starting a new song closes the previous session", () => {
    const t = new ListenTracker()
    t.start("a", 100, 0)
    play(t, 0, 60)
    const prev = t.start("b", 100, 2)
    expect(prev?.songId).toBe("a")
    expect(prev?.counted).toBe(true)
    expect(t.current?.songId).toBe("b")
  })
  it("a quick skip is not a play", () => {
    const t = new ListenTracker()
    t.start("a", 200, 0)
    play(t, 0, 3)
    expect(t.finish()!.counted).toBe(false)
  })
})
