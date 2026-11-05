import { describe, expect, it } from "vitest"
import { fillShelf } from "./homeFeed"

const pl = (id: string, songs = 1) => ({ id, songIds: Array.from({ length: songs }, (_, i) => String(i)) })
const album = (key: string) => ({ key })
const ids = (items: ReturnType<typeof fillShelf<ReturnType<typeof pl>, ReturnType<typeof album>>>) => items.map((x) => (x.kind === "playlist" ? x.item.id : x.item.key))

describe("fillShelf", () => {
  it("puts recent playlists first, in order", () => {
    const out = fillShelf([pl("r2"), pl("r1")], [pl("r1"), pl("r2"), pl("x")], [album("a")], 6)
    expect(ids(out).slice(0, 2)).toEqual(["r2", "r1"])
  })
  it("fills the rest with other playlists and albums, never repeating one", () => {
    const out = ids(fillShelf([pl("r")], [pl("r"), pl("x"), pl("y")], [album("a"), album("b")], 4))
    expect(out).toHaveLength(4)
    expect(new Set(out).size).toBe(4)
    expect(out[0]).toBe("r")
  })
  it("mixes both kinds at random", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 60; i++) seen.add(ids(fillShelf([], [pl("x")], [album("a"), album("b"), album("c")], 1))[0])
    expect(seen.has("x")).toBe(true)
    expect(seen.has("a")).toBe(true)
  })
  it("stops at the maximum, even with lots of recents", () => {
    const recents = Array.from({ length: 9 }, (_, i) => pl(`r${i}`))
    expect(fillShelf(recents, recents, [album("a")], 6)).toHaveLength(6)
  })
  it("shows albums alone for someone with no playlists", () => {
    expect(ids(fillShelf([], [], [album("a")], 6))).toEqual(["a"])
  })
  it("doesn't use empty playlists as filler, but keeps a recent one", () => {
    expect(ids(fillShelf([pl("r", 0)], [pl("r", 0), pl("empty", 0)], [], 6))).toEqual(["r"])
  })
  it("is empty when there's nothing to show", () => {
    expect(fillShelf([], [], [], 6)).toEqual([])
  })
})
