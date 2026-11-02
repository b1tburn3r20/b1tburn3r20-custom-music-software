import { describe, expect, it } from "vitest"
import { buildAlbums, buildArtistList, searchAlbums, searchArtists, searchSongs } from "./catalog"
import type { Song } from "@/types/DirectoryTypes"

const song = (id: string, title: string, artist: string, album: string | null): Song => ({
  id, name: `${title}.mp3`, path: `/m/${id}.mp3`, sourceId: null, addedAt: 0,
  metadata: { title, artist, artists: artist.split(", "), album, albumArtist: null, duration: 100, durationFormatted: "1:40", year: 2020, genre: null, thumbnail: null, description: "", uploadDate: "" },
})
const songs = [
  song("1", "Sky", "Playboi Carti", "Whole Lotta Red"),
  song("2", "Stop Breathing", "Playboi Carti", "Whole Lotta Red"),
  song("3", "Redbone", "Childish Gambino", "Awaken, My Love!"),
  song("4", "Red", "Taylor Swift", "Red"),
  song("5", "Greatest", "Artist A", "Greatest Hits"),
  song("6", "Greatest 2", "Artist B", "Greatest Hits"),
]

describe("search", () => {
  it("finds albums by name and by artist, name matches first", () => {
    const albums = buildAlbums(songs)
    expect(searchAlbums(albums, "red").map((a) => a.album_name)).toEqual(["Red", "Whole Lotta Red"])
    expect(searchAlbums(albums, "carti").map((a) => a.album_name)).toEqual(["Whole Lotta Red"])
    // same-named albums by different artists stay separate
    expect(searchAlbums(albums, "greatest hits")).toHaveLength(2)
  })
  it("finds artists by partial name, exact/prefix first", () => {
    const artists = buildArtistList(songs)
    expect(searchArtists(artists, "car").map((a) => a.name)).toEqual(["Playboi Carti"])
    expect(searchArtists(artists, "playboi carti")[0].songCount).toBe(2)
    expect(searchArtists(artists, "zzz")).toEqual([])
  })
  it("songs still match artist and album text", () => {
    expect(searchSongs(songs, "gambino").map((s) => s.id)).toEqual(["3"])
    expect(searchSongs(songs, "lotta").map((s) => s.id).sort()).toEqual(["1", "2"])
  })
})

describe("tags and radio", () => {
  const civilian = song("c", "Civilian", "Wye Oak", "Civilian")
  const party = song("p", "Party", "Daughter", "Stereo Mind Game")
  const filler = Array.from({ length: 60 }, (_, i) => song(`f${i}`, `Filler ${i}`, `Band ${i}`, null))
  const lib2 = [civilian, party, ...filler]
  const tags = { c: ["somber"], p: ["Somber", "indie"] }

  it("ignores YouTube categories written into the genre tag", async () => {
    const { tagsOf } = await import("./catalog")
    const yt = song("y", "Yt", "Someone", null)
    yt.metadata.genre = "Music"
    const real = song("r", "Real", "Someone", null)
    real.metadata.genre = "Shoegaze"
    expect(tagsOf(yt, {})).toEqual([])
    expect(tagsOf(real, {})).toEqual(["Shoegaze"])
  })

  it("fills with unrelated songs once tag-related ones are used up", async () => {
    const { radioFor } = await import("./catalog")
    const batch = radioFor(lib2, civilian, new Set(), 5, Math.random, tags)
    expect(batch[0].id).toBe("p")
    expect(batch.slice(1).every((s) => s.id.startsWith("f"))).toBe(true)
  })

  it("lists tags (case-insensitive) and finds songs by tag", async () => {
    const { buildTagList, songsWithTag, tagsOf } = await import("./catalog")
    expect(tagsOf(party, tags)).toEqual(["Somber", "indie"])
    const list = buildTagList(lib2, tags)
    expect(list[0]).toMatchObject({ key: "somber", count: 2, own: true })
    expect(songsWithTag(lib2, "SOMBER", tags).map((s) => s.id)).toEqual(["c", "p"])
  })

  it("radio returns every tag-related song before anything outside the tags, most shared tags first", async () => {
    const { radioFor } = await import("./catalog")
    const t2 = { ...tags, f1: ["somber", "indie"], f2: ["indie"], f3: ["somber"] }
    for (let i = 0; i < 50; i++) {
      const q = radioFor(lib2, party, new Set(), 6, Math.random, t2).map((s) => s.id)
      // Party has [somber, indie]: f1 shares both → first; then c, f2, f3 (one each, any order); then the rest
      expect(q[0]).toBe("f1")
      expect(new Set(q.slice(1, 4))).toEqual(new Set(["c", "f2", "f3"]))
      expect(q.slice(4).every((id) => !["c", "f1", "f2", "f3"].includes(id))).toBe(true)
    }
  })

  it("same-artist songs come before unrelated ones when no tags match", async () => {
    const { radioFor } = await import("./catalog")
    const sameArtist = song("w2", "Other Wye Oak song", "Wye Oak", null)
    const q = radioFor([civilian, sameArtist, ...filler], civilian, new Set(), 3, Math.random, {})
    expect(q[0].id).toBe("w2")
  })

  it("ignores YouTube categories written into the genre tag", async () => {
    const { tagsOf } = await import("./catalog")
    const yt = song("y", "Yt", "Someone", null)
    yt.metadata.genre = "Music"
    const real = song("r", "Real", "Someone", null)
    real.metadata.genre = "Shoegaze"
    expect(tagsOf(yt, {})).toEqual([])
    expect(tagsOf(real, {})).toEqual(["Shoegaze"])
  })

  it("fills with unrelated songs once tag-related ones are used up", async () => {
    const { radioFor } = await import("./catalog")
    const batch = radioFor(lib2, civilian, new Set(), 5, Math.random, tags)
    expect(batch[0].id).toBe("p")
    expect(batch.slice(1).every((s) => s.id.startsWith("f"))).toBe(true)
  })

  it("lists tags (case-insensitive) and finds songs by tag", async () => {
    const { buildTagList, songsWithTag, tagsOf } = await import("./catalog")
    expect(tagsOf(party, tags)).toEqual(["Somber", "indie"])
    const list = buildTagList(lib2, tags)
    expect(list[0]).toMatchObject({ key: "somber", count: 2, own: true })
    expect(songsWithTag(lib2, "SOMBER", tags).map((s) => s.id)).toEqual(["c", "p"])
  })

  it("radio strongly prefers songs sharing a tag, even across artists", async () => {
    const { radioFor } = await import("./catalog")
    let hits = 0
    for (let i = 0; i < 200; i++) if (radioFor(lib2, civilian, new Set(), 5, Math.random, tags).some((s) => s.id === "p")) hits++
    // Party is the only related song, so it's in (almost) every batch
    expect(hits / 200).toBeGreaterThan(0.95)
    let hitsNoTags = 0
    for (let i = 0; i < 200; i++) if (radioFor(lib2, civilian, new Set(), 5, Math.random, {}).some((s) => s.id === "p")) hitsNoTags++
    expect(hitsNoTags / 200).toBeLessThan(0.25)
  })
})
