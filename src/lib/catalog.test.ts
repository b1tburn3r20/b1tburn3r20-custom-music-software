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
    const { radioFor } = await import("./radio")
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

  it("radio returns every tag-related song before anything outside the tags, favoring more shared tags", async () => {
    const { radioFor } = await import("./radio")
    const t2 = { ...tags, f1: ["somber", "indie"], f2: ["indie"], f3: ["somber"] }
    let f1First = 0
    for (let i = 0; i < 200; i++) {
      const q = radioFor(lib2, party, new Set(), 6, Math.random, t2).map((s) => s.id)
      // Party has [somber, indie]: all four related songs lead, in any order, f1 (shares both) most often first.
      expect(new Set(q.slice(0, 4))).toEqual(new Set(["c", "f1", "f2", "f3"]))
      if (q[0] === "f1") f1First++
    }
    expect(f1First).toBeGreaterThan(80)
  })

  it("mixes in songs from outside the tags only once every tagged song is used", async () => {
    const { radioFor } = await import("./radio")
    const seed = song("s", "Seed", "Seed Artist", null)
    const sameArtist = song("sa", "Same artist", "Seed Artist", null)
    const inTag = [song("t1", "T1", "A", null), song("t2", "T2", "B", null)]
    const outside = Array.from({ length: 30 }, (_, i) => song(`o${i}`, `O${i}`, `Other ${i}`, null))
    const lib = [seed, sameArtist, ...inTag, ...outside]
    const t = { s: ["sad"], t1: ["sad"], t2: ["sad"] }
    let artistFirst = 0
    for (let i = 0; i < 200; i++) {
      const q = radioFor(lib, seed, new Set(), 4, Math.random, t).map((x) => x.id)
      expect(new Set(q.slice(0, 2))).toEqual(new Set(["t1", "t2"]))
      if (q[2] === "sa") artistFirst++
    }
    // Afterwards it's a real mix: the seed's artist is favored but doesn't always come first.
    expect(artistFirst).toBeGreaterThan(0)
    expect(artistFirst).toBeLessThan(100)
    // A later batch, with the tagged songs already queued, has only the mix left.
    const later = radioFor(lib, seed, new Set(["t1", "t2"]), 3, Math.random, t).map((x) => x.id)
    expect(later.some((id) => id === "t1" || id === "t2")).toBe(false)
    expect(later).toHaveLength(3)
  })

  it("plays similar genres after shared tags and before everything else", async () => {
    const { radioFor } = await import("./radio")
    const seed = song("s", "Seed", "Seed Artist", null)
    const lib = [seed, song("same", "Same", "A", null), song("near", "Near", "B", null), ...Array.from({ length: 20 }, (_, i) => song(`o${i}`, `O${i}`, `Other ${i}`, null))]
    const t = { s: ["shoegaze"], same: ["shoegaze"], near: ["indie rock"], o0: ["jazz"] }
    for (let i = 0; i < 50; i++) expect(radioFor(lib, seed, new Set(), 2, Math.random, t).map((x) => x.id)).toEqual(["same", "near"])
  })

  it("same-artist songs come before unrelated ones when no tags match", async () => {
    const { radioFor } = await import("./radio")
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
    const { radioFor } = await import("./radio")
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
    const { radioFor } = await import("./radio")
    let hits = 0
    for (let i = 0; i < 200; i++) if (radioFor(lib2, civilian, new Set(), 5, Math.random, tags).some((s) => s.id === "p")) hits++
    // Party is the only related song, so it's in (almost) every batch
    expect(hits / 200).toBeGreaterThan(0.95)
    let hitsNoTags = 0
    for (let i = 0; i < 200; i++) if (radioFor(lib2, civilian, new Set(), 5, Math.random, {}).some((s) => s.id === "p")) hitsNoTags++
    expect(hitsNoTags / 200).toBeLessThan(0.25)
  })
})

describe("radio taste and sequencing", () => {
  const make = (id: string, artist: string, extra: Partial<Song["metadata"]> = {}) => {
    const s = song(id, id, artist, null)
    Object.assign(s.metadata, extra)
    return s
  }
  const firstPickRate = async (lib: Song[], seed: Song, id: string, tags: Record<string, string[]>, taste: object) => {
    const { radioFor } = await import("./radio")
    let n = 0
    for (let i = 0; i < 400; i++) if (radioFor(lib, seed, new Set(), 1, Math.random, tags, taste)[0]?.id === id) n++
    return n / 400
  }
  const seed = make("seed", "Seed")
  const a = make("a", "A")
  const b = make("b", "B")
  const tags = { seed: ["sad"], a: ["sad"], b: ["sad"] }
  const NOW = 1_000 * 3_600_000
  const lib = [seed, a, b]

  it("leaves out audiobooks and very long tracks, unless you started from one", async () => {
    const { radioFor } = await import("./radio")
    const loop = make("loop", "L", { duration: 36_000 })
    const book = make("book", "K")
    const t = { ...tags, book: ["audiobook", "sad"], loop: ["sad"] }
    const ids = radioFor([...lib, loop, book], seed, new Set(), 5, Math.random, t).map((s) => s.id)
    expect(ids).toEqual(expect.arrayContaining(["a", "b"]))
    expect(ids).not.toContain("loop")
    expect(ids).not.toContain("book")
    expect(radioFor([...lib, loop], make("long", "Z", { duration: 3_600 }), new Set(), 5, Math.random, { ...t, long: ["sad"] }).map((s) => s.id)).toContain("loop")
  })
  it("favors what you like and play", async () => {
    expect(await firstPickRate(lib, seed, "a", tags, { likedIds: new Set(["a"]) })).toBeGreaterThan(0.6)
  })
  it("favors songs in a playlist with the seed", async () => {
    expect(await firstPickRate(lib, seed, "a", tags, { playlists: [{ songIds: ["seed", "a"] }] })).toBeGreaterThan(0.7)
  })
  it("favors songs you chose to hear with the seed", async () => {
    const signals = { songs: {}, together: { seed: { a: 5 } } }
    expect(await firstPickRate(lib, seed, "a", tags, { signals })).toBeGreaterThan(0.7)
  })
  it("holds back what you just heard and what you keep skipping", async () => {
    const heard = { songs: { a: { plays: 1, skips: 0, lastPlayedAt: NOW - 3_600_000, lastSkippedAt: 0 } }, together: {} }
    expect(await firstPickRate(lib, seed, "a", tags, { signals: heard, now: NOW })).toBeLessThan(0.15)
    const skipped = { songs: { a: { plays: 0, skips: 5, lastPlayedAt: NOW - 1_000 * 3_600_000, lastSkippedAt: NOW - 1_000 * 3_600_000 } }, together: {} }
    expect(await firstPickRate(lib, seed, "a", tags, { signals: skipped, now: NOW })).toBeLessThan(0.15)
  })
  it("backs off an artist you skipped just now", async () => {
    const other = make("other", "A")
    const signals = { songs: { other: { plays: 0, skips: 1, lastPlayedAt: NOW - 60_000, lastSkippedAt: NOW - 60_000 } }, together: {} }
    expect(await firstPickRate([...lib, other], seed, "a", { ...tags, other: ["jazz"] }, { signals, now: NOW })).toBeLessThan(0.4)
  })
  it("taste never moves a song ahead of a better tag match", async () => {
    const { radioFor } = await import("./radio")
    const outside = make("outside", "O")
    const taste = { likedIds: new Set(["outside"]), playlists: [{ songIds: ["seed", "outside"] }], signals: { songs: {}, together: { seed: { outside: 5 } } } }
    for (let i = 0; i < 50; i++) expect(radioFor([seed, a, b, outside], seed, new Set(), 3, Math.random, tags, taste)[2].id).toBe("outside")
  })
  it("keeps an artist from playing twice in a row while others are left", async () => {
    const { radioFor } = await import("./radio")
    const many = [make("x1", "X"), make("x2", "X"), make("x3", "X"), make("y1", "Y"), make("y2", "Y"), make("z1", "Z")]
    const t = { seed: ["sad"], ...Object.fromEntries(many.map((s) => [s.id, ["sad"]])) }
    for (let i = 0; i < 50; i++) {
      const q = radioFor([seed, ...many], seed, new Set(), 3, Math.random, t)
      expect(new Set(q.map((s) => s.metadata.artist)).size).toBe(3)
    }
    // Across batches too: the last songs in the queue count.
    for (let i = 0; i < 50; i++) expect(radioFor([seed, ...many], seed, new Set(), 1, Math.random, t, { recent: [many[0]] })[0].metadata.artist).not.toBe("X")
  })
  it("doesn't let an artist whose songs share the most tags take over", async () => {
    const { radioFor } = await import("./radio")
    const own = Array.from({ length: 10 }, (_, i) => make(`x${i}`, "X"))
    const others = Array.from({ length: 10 }, (_, i) => make(`o${i}`, `O${i}`))
    const t = { seed: ["chill", "lo-fi"], ...Object.fromEntries(own.map((s) => [s.id, ["chill", "lo-fi"]])), ...Object.fromEntries(others.map((s) => [s.id, ["chill"]])) }
    const q = radioFor([seed, ...own, ...others], seed, new Set(), 9, Math.random, t)
    expect(q.filter((s) => s.metadata.artist === "X").length).toBeLessThanOrEqual(3)
  })

  it("doesn't play another version of a song already in the queue", async () => {
    const { radioFor } = await import("./radio")
    const orig = make("Hold On", "V")
    const slowed = make("Hold On (Slowed)", "V")
    const t = { seed: ["sad"], "Hold On": ["sad"], "Hold On (Slowed)": ["sad"] }
    expect(radioFor([seed, orig, slowed], seed, new Set(), 5, Math.random, t)).toHaveLength(1)
    expect(radioFor([seed, orig, slowed], seed, new Set(["Hold On"]), 5, Math.random, t)).toHaveLength(0)
  })
})
