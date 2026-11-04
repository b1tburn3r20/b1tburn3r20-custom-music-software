import { describe, expect, it } from "vitest"
import type { Song } from "@/types/DirectoryTypes"
import { daysListened, favorites, lastDays, quickPicks, songsToTag, suggestTags, weekChange } from "./homeFeed"

const song = (id: string, artist = `artist-${id}`, genre?: string) => ({ id, name: id, metadata: { title: id, artist, artists: [artist], genre } }) as unknown as Song
const MIN = 60_000
const NOW = new Date(2026, 10, 4, 12).getTime() // Nov 4 2026, local noon

describe("daysListened", () => {
  it("counts every listening day, gaps included, and finds the first", () => {
    const out = daysListened([{ day: "2026-11-03", ms: MIN }, { day: "2026-10-30", ms: MIN }, { day: "2026-11-02", ms: MIN }])
    expect(out.days).toBe(3)
    expect(out.since).toEqual(new Date(2026, 9, 30))
  })
  it("ignores accidental seconds of listening", () => {
    expect(daysListened([{ day: "2026-11-04", ms: 5000 }])).toEqual({ days: 0, since: null })
  })
})

describe("week summaries", () => {
  it("fills silent days", () => {
    const days = lastDays([{ day: "2026-11-04", ms: 5 }], 7, NOW)
    expect(days).toHaveLength(7)
    expect(days[6]).toMatchObject({ day: "2026-11-04", ms: 5 })
    expect(days[0]).toMatchObject({ day: "2026-10-29", ms: 0 })
  })
  it("compares with the week before", () => {
    expect(weekChange([{ day: "2026-10-25", ms: 100 }, { day: "2026-11-01", ms: 150 }], NOW)).toBe("+50% vs last week")
    expect(weekChange([{ day: "2026-10-25", ms: 100 }, { day: "2026-11-01", ms: 50 }], NOW)).toBe("−50% vs last week")
    expect(weekChange([{ day: "2026-11-01", ms: 50 }], NOW)).toBeNull()
  })
})

describe("quickPicks", () => {
  const base = { top: [], likes: [], recentIds: [], count: 3, rand: () => 0.5 }
  it("skips what you just heard", () => {
    const songs = ["a", "b", "c", "d"].map((id) => song(id))
    expect(quickPicks(songs, { ...base, recentIds: ["a"] }).map((s) => s.id)).not.toContain("a")
  })
  it("falls back to recent songs in a small library", () => {
    const songs = ["a", "b", "c"].map((id) => song(id))
    expect(quickPicks(songs, { ...base, recentIds: ["a", "b"] })).toHaveLength(3)
  })
  it("limits an artist until nothing else is left", () => {
    const songs = [song("a", "x"), song("b", "x"), song("c", "x"), song("d", "y")]
    const three = quickPicks(songs, { ...base, perArtist: 1, count: 2 }).map((s) => s.id)
    expect(three).toContain("d")
    expect(quickPicks(songs, { ...base, perArtist: 1, count: 4 })).toHaveLength(4)
  })
})

describe("favorites", () => {
  it("ranks plays and likes, and leaves out songs you barely played", () => {
    const songs = [song("liked"), song("played"), song("meh")]
    const out = favorites(songs, { top: [{ songId: "played", plays: 20 }, { songId: "meh", plays: 2 }], likes: [{ songId: "liked", likedAt: 1 }], count: 10 })
    expect(out.map((s) => s.id)).toEqual(["played", "liked"])
  })
})

describe("songsToTag", () => {
  it("lists only untagged songs, most listened first", () => {
    const songs = [song("new"), song("tagged"), song("liked"), song("played")]
    const out = songsToTag(songs, { songTags: { tagged: ["rock"] }, top: [{ songId: "played", plays: 3 }], likes: [{ songId: "liked", likedAt: 1 }], recentIds: [], downloadedAt: {} })
    expect(out.map((c) => [c.song.id, c.reason])).toEqual([["played", "3 plays"], ["liked", "liked"], ["new", ""]])
  })
  it("doesn't treat a file genre as tagged", () => {
    const out = songsToTag([song("a", "x", "Rock")], { songTags: {}, top: [], likes: [], recentIds: [], downloadedAt: {} })
    expect(out).toHaveLength(1)
  })
})

describe("suggestTags", () => {
  it("prefers the artist's tags, then the genre, then your most used", () => {
    const target = song("t", "x", "Metal")
    const songs = [target, song("a", "x"), song("b", "y"), song("c", "y")]
    const tags = { a: ["moody"], b: ["party"], c: ["party"] }
    expect(suggestTags(target, songs, tags)).toEqual(["moody", "metal", "party"])
  })
  it("merges case differences and respects the limit", () => {
    const songs = [song("t"), song("a"), song("b"), song("c")]
    expect(suggestTags(songs[0], songs, { a: ["Rock"], b: ["rock"], c: ["pop"] }, 1)).toEqual(["Rock"])
  })
})
