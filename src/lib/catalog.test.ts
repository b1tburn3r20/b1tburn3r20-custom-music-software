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
