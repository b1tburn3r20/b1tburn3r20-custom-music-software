import { describe, expect, it } from "vitest"
import { findOwnedSong, isSameSong, parseVideoTitle } from "./songMatch.mjs"

const meta = (title: string, artist: string, duration: number) => ({ title, artist, artists: artist.split(", "), duration })
const lib = [
  { id: "s1", sourceId: null, metadata: meta("JUMP", "DaBaby, YoungBoy Never Broke Again", 187) },
  { id: "s2", sourceId: null, metadata: meta("Blankets", "Aso", 140) },
  { id: "s3", sourceId: null, metadata: meta("blankets", "fantompower", 95) },
  { id: "s4", sourceId: "abcdefghijk", metadata: meta("Retro 88", "MadeinTYO", 160) },
]

describe("parseVideoTitle", () => {
  it("strips decorations and splits 'Artist - Title'", () => {
    expect(parseVideoTitle("DaBaby - JUMP (Official Video) ft. NBA YoungBoy")).toEqual({ artist: "dababy", title: "jump" })
    expect(parseVideoTitle("Sky [Lyrics]")).toEqual({ artist: "", title: "sky" })
    expect(parseVideoTitle("Kriss Kross - Jump (Remix)")).toEqual({ artist: "kriss kross", title: "jump remix" })
  })
})

describe("isSameSong / findOwnedSong", () => {
  it("does not confuse two different songs with the same title", () => {
    const krissKross = { id: "v1", title: "Kriss Kross - Jump (Official Video)", channel: "KrissKrossVEVO", duration: 195 }
    expect(findOwnedSong(lib, krissKross)).toBeNull()
    const vanHalen = { id: "v2", title: "JUMP", channel: "Van Halen", duration: 241 }
    expect(findOwnedSong(lib, vanHalen)).toBeNull()
  })
  it("matches the same recording by title + artist + duration", () => {
    const v = { id: "v3", title: "DaBaby - JUMP (Official Video) ft. NBA YoungBoy", channel: "DaBaby", duration: 188 }
    expect(findOwnedSong(lib, v)?.song.id).toBe("s1")
    const topic = { id: "v4", title: "Blankets", channel: "Aso - Topic", duration: 141 }
    expect(findOwnedSong(lib, topic)?.song.id).toBe("s2")
  })
  it("rejects matches whose length is off", () => {
    expect(isSameSong(meta("JUMP", "DaBaby", 187), { title: "DaBaby - JUMP", channel: "DaBaby", duration: 230 })).toBe(false)
  })
  it("uses exact YouTube ids first", () => {
    expect(findOwnedSong(lib, { id: "abcdefghijk", title: "whatever", channel: "", duration: 0 })).toEqual({ song: lib[3], exact: true })
  })
})
