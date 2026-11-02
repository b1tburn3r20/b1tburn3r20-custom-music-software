// Pure catalog functions over the in-memory library: albums, artists, search
// and "radio" suggestions. These used to be IPC calls that re-scanned the whole
// song cache in the main process on every click.
import type { AlbumType, ArtistType } from "@/types/AppTypes"
import type { Song } from "@/types/DirectoryTypes"

const lc = (s: string | null | undefined) => (s ?? "").trim().toLowerCase()

export function songArtists(song: Song): string[] {
  const a = song.metadata.artists
  if (a && a.length) return a
  return song.metadata.artist && lc(song.metadata.artist) !== "unknown artist" ? [song.metadata.artist] : []
}

const byTrackOrder = (a: Song, b: Song) => (a.metadata.title || "").localeCompare(b.metadata.title || "")

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, { n: number; v: string }>()
  for (const v of values) {
    const k = lc(v)
    const c = counts.get(k)
    if (c) c.n++
    else counts.set(k, { n: 1, v })
  }
  let best: { n: number; v: string } | null = null
  for (const c of counts.values()) if (!best || c.n > best.n) best = c
  return best ? best.v : null
}

function buildAlbum(songs: Song[], name: string): AlbumType {
  const artists: string[] = []
  const seen = new Set<string>()
  const years: number[] = []
  let thumb: string | null = null
  for (const s of songs) {
    for (const a of songArtists(s)) {
      if (!seen.has(lc(a))) {
        seen.add(lc(a))
        artists.push(a)
      }
    }
    if (s.metadata.year && !years.includes(s.metadata.year)) years.push(s.metadata.year)
    if (!thumb && s.metadata.thumbnail) thumb = s.metadata.thumbnail
  }
  const main = mostCommon(songs.map((s) => s.metadata.albumArtist || songArtists(s)[0] || "")) || ""
  return {
    key: `${lc(name)}::${lc(main)}`,
    album_name: name,
    album_artists: artists,
    album_release_date: years.sort(),
    album_songs: [...songs].sort(byTrackOrder),
    album_thumbnail: thumb,
  }
}

/**
 * Groups songs into albums. Songs with the same album name are only merged when
 * they share an album artist or at least one artist, so two different
 * "Greatest Hits" albums don't collapse into one.
 */
export function buildAlbums(songs: Song[]): AlbumType[] {
  const byName = new Map<string, Song[]>()
  for (const s of songs) {
    const name = s.metadata.album
    if (!name || lc(name) === "unknown album") continue
    const k = lc(name)
    const list = byName.get(k)
    if (list) list.push(s)
    else byName.set(k, [s])
  }
  const albums: AlbumType[] = []
  for (const group of byName.values()) {
    // union-find over shared artists
    const parent = group.map((_, i) => i)
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
    const owner = new Map<string, number>()
    group.forEach((s, i) => {
      const keys = s.metadata.albumArtist ? [`aa:${lc(s.metadata.albumArtist)}`] : songArtists(s).map((a) => `a:${lc(a)}`)
      if (!keys.length) keys.push("a:")
      for (const k of keys) {
        const o = owner.get(k)
        if (o === undefined) owner.set(k, i)
        else parent[find(i)] = find(o)
      }
    })
    const clusters = new Map<number, Song[]>()
    group.forEach((s, i) => {
      const r = find(i)
      const c = clusters.get(r)
      if (c) c.push(s)
      else clusters.set(r, [s])
    })
    for (const c of clusters.values()) albums.push(buildAlbum(c, c[0].metadata.album as string))
  }
  return albums.sort((a, b) => a.album_name.localeCompare(b.album_name))
}

export function albumForSong(albums: AlbumType[], songId: string): AlbumType | null {
  return albums.find((a) => a.album_songs.some((s) => s.id === songId)) ?? null
}

export function buildArtist(songs: Song[], albums: AlbumType[], artistName: string): ArtistType | null {
  const key = lc(artistName)
  if (!key || key === "unknown artist") return null
  const artistSongs = songs.filter((s) => songArtists(s).some((a) => lc(a) === key))
  if (!artistSongs.length) return null
  const ids = new Set(artistSongs.map((s) => s.id))
  const artistAlbums = albums.filter((al) => al.album_songs.some((s) => ids.has(s.id)))
  const display = artistSongs.flatMap(songArtists).find((a) => lc(a) === key) ?? artistName
  return {
    key,
    artist_name: display,
    artist_songs: [...artistSongs].sort(byTrackOrder),
    artist_albums: artistAlbums,
    artist_thumbnail: artistSongs.find((s) => s.metadata.thumbnail)?.metadata.thumbnail ?? null,
  }
}

export function buildArtistList(songs: Song[]): { key: string; name: string; songCount: number; thumbnail: string | null }[] {
  const map = new Map<string, { key: string; name: string; songCount: number; thumbnail: string | null }>()
  for (const s of songs) {
    for (const a of songArtists(s)) {
      const k = lc(a)
      const e = map.get(k)
      if (e) {
        e.songCount++
        if (!e.thumbnail) e.thumbnail = s.metadata.thumbnail
      } else map.set(k, { key: k, name: a, songCount: 1, thumbnail: s.metadata.thumbnail })
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function haystack(s: Song) {
  const m = s.metadata
  return lc([m.title, m.artist, m.album, m.genre, s.name].filter(Boolean).join(" "))
}

/** Every word of the query must appear in title/artist/album/genre/filename. Title matches rank first. */
export function searchSongs(songs: Song[], query: string, limit = Infinity): Song[] {
  const words = lc(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const scored: { s: Song; score: number }[] = []
  for (const s of songs) {
    const h = haystack(s)
    if (!words.every((w) => h.includes(w))) continue
    const t = lc(s.metadata.title)
    const score = (t === lc(query) ? 0 : t.startsWith(words[0]) ? 1 : words.every((w) => t.includes(w)) ? 2 : 3)
    scored.push({ s, score })
  }
  scored.sort((a, b) => a.score - b.score || a.s.metadata.title.localeCompare(b.s.metadata.title))
  return scored.slice(0, limit).map((x) => x.s)
}

export function shuffled<T>(arr: readonly T[], rand: () => number = Math.random): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Radio suggestions: same-artist songs first (shuffled), then the rest (shuffled). */
export function radioFor(songs: Song[], seed: Song, exclude: Set<string>, count = 15, rand: () => number = Math.random): Song[] {
  const seedArtists = new Set(songArtists(seed).map(lc))
  const same: Song[] = []
  const other: Song[] = []
  for (const s of songs) {
    if (s.id === seed.id || exclude.has(s.id)) continue
    ;(songArtists(s).some((a) => seedArtists.has(lc(a))) ? same : other).push(s)
  }
  return [...shuffled(same, rand), ...shuffled(other, rand)].slice(0, count)
}
