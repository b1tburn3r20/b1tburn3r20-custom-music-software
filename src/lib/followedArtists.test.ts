import { describe, expect, it } from "vitest"
import type { Song } from "@/types/DirectoryTypes"
import { followedSongIds, matchedSubscriptions } from "./followedArtists"

const song = (id: string, artist: string, artists?: string[]) => ({ id, metadata: { title: id, artist, artists: artists ?? [artist] } }) as unknown as Song
const sub = (title: string) => ({ channelId: title, title })

describe("followedSongIds", () => {
  it("matches an official artist channel, not just Topic or VEVO ones", () => {
    expect(followedSongIds([song("a", "Radiohead")], [sub("Radiohead")])).toEqual(new Set(["a"]))
  })
  it("matches - Topic and VEVO channel names", () => {
    const songs = [song("a", "Radiohead"), song("b", "Taylor Swift")]
    expect(followedSongIds(songs, [sub("Radiohead - Topic"), sub("TaylorSwiftVEVO")]).has("a")).toBe(true)
    expect(followedSongIds(songs, [sub("Taylor Swift VEVO")]).has("b")).toBe(true)
  })
  it("ignores case, accents and punctuation", () => {
    expect(followedSongIds([song("a", "Beyoncé")], [sub("BEYONCE")]).has("a")).toBe(true)
    expect(followedSongIds([song("a", "AC/DC")], [sub("ac dc")]).has("a")).toBe(true)
  })
  it("matches any of a song's artists", () => {
    expect(followedSongIds([song("a", "X feat. Y", ["X", "Y"])], [sub("Y")]).has("a")).toBe(true)
  })
  it("doesn't match on part of a name", () => {
    expect(followedSongIds([song("a", "The Weeknd")], [sub("Weekend")]).size).toBe(0)
    expect(followedSongIds([song("a", "Muse")], [sub("Museum Tours")]).size).toBe(0)
  })
  it("is empty without subscriptions, so nothing depends on YouTube", () => {
    expect(followedSongIds([song("a", "Anyone")], [])).toEqual(new Set())
  })
  it("doesn't let an empty channel name match unknown artists", () => {
    expect(followedSongIds([song("a", "")], [sub(" - Topic")]).size).toBe(0)
  })
})

describe("matchedSubscriptions", () => {
  it("keeps only channels whose artist is in the library", () => {
    const list = matchedSubscriptions([song("a", "Radiohead")], [sub("Radiohead - Topic"), sub("Cooking With Sam")])
    expect(list.map((s) => s.title)).toEqual(["Radiohead - Topic"])
  })
})
