import { describe, expect, it } from "vitest"
import type { Song } from "@/types/DirectoryTypes"
import { radioFor } from "./radio"

const song = (id: string, artist: string) => ({ id, path: `/m/${id}.mp3`, thumbnail: null, metadata: { title: id, artist, artists: [artist], album: null, duration: 180 } }) as unknown as Song

const seed = song("seed", "Seed Artist")
const followed = song("followed", "Followed Artist")
const liked = song("liked", "Liked Artist")
const others = Array.from({ length: 8 }, (_, i) => song(`other${i}`, `Artist ${i}`))
const library = [seed, followed, liked, ...others]

function firstPickRate(taste: Parameters<typeof radioFor>[6], target: string, runs = 3000) {
  let hits = 0
  for (let i = 0; i < runs; i++) if (radioFor(library, seed, new Set(), 1, Math.random, {}, taste)[0]?.id === target) hits++
  return hits / runs
}

describe("followed artists on radio", () => {
  it("come up more often", () => {
    const without = firstPickRate({}, "followed")
    const withBoost = firstPickRate({ followedIds: new Set(["followed"]) }, "followed")
    expect(withBoost).toBeGreaterThan(without * 1.2)
  })

  it("count for less than liking the song itself", () => {
    const taste = { followedIds: new Set(["followed"]), likedIds: new Set(["liked"]) }
    expect(firstPickRate(taste, "liked")).toBeGreaterThan(firstPickRate(taste, "followed"))
  })

  it("change nothing for someone without YouTube", () => {
    const none = radioFor(library, seed, new Set(), library.length, () => 0.5, {}, {})
    const empty = radioFor(library, seed, new Set(), library.length, () => 0.5, {}, { followedIds: new Set() })
    expect(empty.map((s) => s.id)).toEqual(none.map((s) => s.id))
    expect(none.length).toBeGreaterThan(0)
  })
})
