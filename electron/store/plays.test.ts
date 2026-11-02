import { createRequire } from "module"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const { aggregate, sanitizeEvent } = require("./plays.cjs")
const DAY = 86_400_000
const now = 100 * DAY
const ev = (songId: string, daysAgo: number, listenedMs: number, counted = true) => ({ songId, endedAt: now - daysAgo * DAY, listenedMs, counted })
const info = (id: string) => ({ a: { artists: ["X", "Y"] }, b: { artists: ["X"] }, c: { artists: [] } } as Record<string, { artists: string[] }>)[id] ?? null

describe("aggregate", () => {
  const events = [ev("a", 1, 200_000), ev("a", 2, 180_000), ev("b", 3, 60_000), ev("b", 20, 60_000), ev("c", 60, 30_000), ev("a", 1, 5_000, false), ev("deleted", 1, 99_000)]
  it("filters by range and skips deleted songs", () => {
    const w = aggregate(events, { range: "week", now, songInfo: info })
    expect(w.plays).toBe(3)
    expect(w.totalMs).toBe(445_000) // includes the uncounted 5 s, excludes the deleted song
    const m = aggregate(events, { range: "month", now, songInfo: info })
    expect(m.plays).toBe(4)
    const all = aggregate(events, { range: "all", now, songInfo: info })
    expect(all.plays).toBe(5)
    expect(all.uniqueSongs).toBe(3)
  })
  it("ranks top songs and splits artists", () => {
    const all = aggregate(events, { range: "all", now, songInfo: info })
    expect(all.topSongs[0]).toMatchObject({ songId: "a", plays: 2 })
    expect(all.topArtists[0]).toMatchObject({ name: "X", plays: 4, songCount: 2 })
    expect(all.topArtists.find((a: { name: string }) => a.name === "Unknown artist")).toBeTruthy()
  })
})

describe("sanitizeEvent", () => {
  it("drops sub-second sessions and junk", () => {
    expect(sanitizeEvent({ songId: "a", listenedMs: 500 })).toBeNull()
    expect(sanitizeEvent({ listenedMs: 5000 })).toBeNull()
    expect(sanitizeEvent({ songId: "a", listenedMs: 5000, counted: 1 })).toMatchObject({ songId: "a", listenedMs: 5000, counted: true })
  })
})
