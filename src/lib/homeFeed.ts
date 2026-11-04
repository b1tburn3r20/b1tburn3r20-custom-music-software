// Pure logic behind the home page: fun numbers, quick picks, favorites and the
// "songs to tag" queue. Everything takes plain data so it can be unit tested.
import type { Song } from "@/types/DirectoryTypes"
import { realGenre, songArtists, type TagMap } from "@/lib/catalog"
import { canonicalTag } from "@/lib/tagPresets"

type Daily = { day: string; ms: number }[]
type Played = { songId: string; plays: number }
type Liked = { songId: string; likedAt: number }

const lc = (s: string) => s.trim().toLowerCase()
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
/** Local calendar day `back` days before `now` (safe across DST changes). */
const daysAgo = (now: number, back: number) => {
  const d = new Date(now)
  d.setDate(d.getDate() - back)
  return d
}

/** A minute of music makes it a listening day; an accidental click doesn't. */
const LISTENING_DAY_MIN_MS = 60_000

/** How many days you've listened at all, and the first of them (as a local date). */
export function daysListened(daily: Daily): { days: number; since: Date | null } {
  const active = daily.filter((d) => d.ms >= LISTENING_DAY_MIN_MS).map((d) => d.day).sort()
  if (!active.length) return { days: 0, since: null }
  const [y, m, d] = active[0].split("-").map(Number)
  return { days: active.length, since: new Date(y, m - 1, d) }
}

/** Listening per day for the last `days` days, oldest first, including silent days. */
export function lastDays(daily: Daily, days: number, now = Date.now()): { day: string; ms: number; date: Date }[] {
  const map = new Map(daily.map((d) => [d.day, d.ms]))
  return Array.from({ length: days }, (_, i) => {
    const date = daysAgo(now, days - 1 - i)
    return { day: dayKey(date), ms: map.get(dayKey(date)) ?? 0, date }
  })
}

/** "+20% vs last week", or null when there is no previous week to compare with. */
export function weekChange(daily: Daily, now = Date.now()): string | null {
  const days = lastDays(daily, 14, now)
  const sum = (part: typeof days) => part.reduce((a, d) => a + d.ms, 0)
  const before = sum(days.slice(0, 7))
  if (!before) return null
  const pct = Math.round(((sum(days.slice(7)) - before) / before) * 100)
  if (pct === 0) return "same as last week"
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)}% vs last week`
}

/**
 * Songs worth playing right now: favors what you play and like, skips what you
 * just heard, and keeps any one artist from filling the list.
 */
export function quickPicks(
  songs: Song[],
  opts: { top: Played[]; likes: Liked[]; recentIds: string[]; count: number; perArtist?: number; rand?: () => number },
): Song[] {
  const { top, likes, recentIds, count, perArtist = 2, rand = Math.random } = opts
  const plays = new Map(top.map((t) => [t.songId, t.plays]))
  const liked = new Set(likes.map((l) => l.songId))
  const recent = new Set(recentIds)
  const fresh = songs.filter((s) => !recent.has(s.id))
  const pool = fresh.length >= count ? fresh : songs
  // Weighted random order (Efraimidis–Spirakis): loved songs surface often, not always.
  const ranked = pool
    .map((s) => ({ s, k: Math.pow(rand() || 1e-12, 1 / (1 + Math.sqrt(plays.get(s.id) ?? 0) + (liked.has(s.id) ? 3 : 0))) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.s)

  const out: Song[] = []
  const overflow: Song[] = []
  const perArtistCount = new Map<string, number>()
  for (const s of ranked) {
    if (out.length === count) break
    const artist = lc(songArtists(s)[0] ?? "")
    const n = perArtistCount.get(artist) ?? 0
    if (artist && n >= perArtist) {
      overflow.push(s)
      continue
    }
    perArtistCount.set(artist, n + 1)
    out.push(s)
  }
  return [...out, ...overflow].slice(0, count)
}

/** Most-played first; a like is worth a few plays. Includes heavily played songs you never liked. */
export function favorites(songs: Song[], opts: { top: Played[]; likes: Liked[]; count: number; minPlays?: number }): Song[] {
  const { top, likes, count, minPlays = 5 } = opts
  const plays = new Map(top.map((t) => [t.songId, t.plays]))
  const likedAt = new Map(likes.map((l) => [l.songId, l.likedAt]))
  return songs
    .filter((s) => likedAt.has(s.id) || (plays.get(s.id) ?? 0) >= minPlays)
    .map((s) => ({ s, score: (plays.get(s.id) ?? 0) + (likedAt.has(s.id) ? 5 : 0), at: likedAt.get(s.id) ?? 0 }))
    .sort((a, b) => b.score - a.score || b.at - a.at)
    .slice(0, count)
    .map((x) => x.s)
}

export type TagCandidate = { song: Song; reason: string }

/**
 * Songs without any of your own tags, the ones you'd notice most first: most
 * played, then liked, then recently played, then newest downloads. Tagging these
 * first improves the radio the most. A file genre doesn't count as tagged.
 */
export function songsToTag(
  songs: Song[],
  opts: { songTags: TagMap; top: Played[]; likes: Liked[]; recentIds: string[]; downloadedAt: Record<string, number> },
): TagCandidate[] {
  const { songTags, top, likes, recentIds, downloadedAt } = opts
  const plays = new Map(top.map((t) => [t.songId, t.plays]))
  const liked = new Set(likes.map((l) => l.songId))
  const recent = new Set(recentIds)
  const tier = (s: Song) => ((plays.get(s.id) ?? 0) > 0 ? 0 : liked.has(s.id) ? 1 : recent.has(s.id) ? 2 : 3)
  const reason = (s: Song) => {
    const n = plays.get(s.id) ?? 0
    if (n > 0) return `${n} ${n === 1 ? "play" : "plays"}`
    if (liked.has(s.id)) return "liked"
    if (recent.has(s.id)) return "played recently"
    return downloadedAt[s.id] ? "downloaded" : ""
  }
  return songs
    .filter((s) => !songTags[s.id]?.length)
    .sort((a, b) => tier(a) - tier(b) || (plays.get(b.id) ?? 0) - (plays.get(a.id) ?? 0) || (downloadedAt[b.id] ?? 0) - (downloadedAt[a.id] ?? 0) || a.metadata.title.localeCompare(b.metadata.title))
    .map((song) => ({ song, reason: reason(song) }))
}

/**
 * One-click tag ideas for a song: what you already tagged this artist with, then
 * the file's genre, then your most used tags.
 */
export function suggestTags(song: Song, songs: Song[], songTags: TagMap, limit = 4): string[] {
  const artists = new Set(songArtists(song).map(lc))
  const sameArtist = new Map<string, { name: string; n: number }>()
  const overall = new Map<string, { name: string; n: number }>()
  for (const s of songs) {
    const own = songTags[s.id]
    if (!own?.length) continue
    const related = s.id !== song.id && songArtists(s).some((a) => artists.has(lc(a)))
    for (const t of own) {
      const k = lc(t)
      overall.set(k, { name: overall.get(k)?.name ?? t, n: (overall.get(k)?.n ?? 0) + 1 })
      if (related) sameArtist.set(k, { name: sameArtist.get(k)?.name ?? t, n: (sameArtist.get(k)?.n ?? 0) + 1 })
    }
  }
  const byCount = (m: Map<string, { name: string; n: number }>) => [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).map((x) => x.name)
  const fileGenre = realGenre(song)
  const genre = fileGenre && canonicalTag(fileGenre, [...overall.values()].map((x) => x.name))
  const out: string[] = []
  const seen = new Set<string>()
  for (const t of [...byCount(sameArtist), ...(genre ? [genre] : []), ...byCount(overall)]) {
    if (seen.has(lc(t))) continue
    seen.add(lc(t))
    out.push(t)
    if (out.length === limit) break
  }
  return out
}
