// Radio: picks what plays next, in three steps like the big streaming services.
//  1. Candidates: every song that could fit (no audiobooks or hour-long mixes).
//  2. Scoring: how well each one fits this seed and your taste. Scores only change
//     the odds, so no two radios are the same.
//  3. Sequencing: keep the same artist from playing twice in a row, and the same
//     song from appearing twice in another version.
// Tiers are strict: scoring orders songs inside a tier and never moves one across.
import type { RadioSignals } from "@/types/api"
import type { Song } from "@/types/DirectoryTypes"
import { songArtists, tagsOf, type TagMap } from "@/lib/catalog"
import { tagFamily } from "@/lib/tagPresets"
import { normalizeSongTitle } from "../../shared/songMatch.mjs"

const lc = (s: string) => s.trim().toLowerCase()

const HOUR = 3_600_000
/** Longer than this is a mix, audiobook or 10-hour loop, not a radio song (unless that's what you started from). */
const MAX_TRACK_SECONDS = 20 * 60
const NEVER_ON_RADIO = new Set(["audiobook", "audiobooks", "podcast"])
/** Once a radio's tags are exhausted, how much likelier the seed's artist is. */
const MIX_ARTIST_WEIGHT = 3
/** Songs in a row before an artist may return, if there's anyone else left in the tier. */
const ARTIST_GAP = 2
/** Each extra shared tag makes a song this much likelier: strongly favored, without one artist taking over. */
const EXTRA_SHARED_TAG_WEIGHT = 4
/** Skipping a song just now means less of that artist for the next while. */
const SESSION_SKIP_WINDOW = HOUR
const SESSION_SKIP_FACTOR = 0.3

export type RadioTaste = {
  signals?: RadioSignals | null
  likedIds?: ReadonlySet<string>
  playlists?: readonly { songIds: string[] }[]
  /** What plays right before these songs, oldest first, so artists stay apart across batches. */
  recent?: readonly Song[]
  now?: number
}

const isLong = (s: Song) => (s.metadata.duration || 0) > MAX_TRACK_SECONDS
/** Same song in another version: "Redbone" and "Redbone (Slowed)" by the same artist. */
function versionKey(s: Song): string {
  const title = normalizeSongTitle(s.metadata.title.replace(/\([^)]*\)|\[[^\]]*\]/g, " "))
  return title ? `${title}|${lc(songArtists(s)[0] ?? "")}` : s.id
}

/** A song you just heard shouldn't come straight back, but isn't banned for good. */
function recencyFactor(lastPlayedAt: number | undefined, now: number): number {
  if (!lastPlayedAt) return 1
  const hours = (now - lastPlayedAt) / HOUR
  return hours < 3 ? 0.05 : hours < 24 ? 0.3 : hours < 24 * 7 ? 0.7 : 1
}

/** Songs you keep skipping sink; it takes a few tries to count, and they're never removed. */
function skipFactor(plays: number, skips: number): number {
  if (plays + skips < 3) return 1
  return Math.max(0.05, (plays / (plays + skips)) ** 2)
}

/** Efraimidis–Spirakis: a random order where higher weights tend to come first. */
function weightedOrder(items: { song: Song; w: number }[], rand: () => number): Song[] {
  return items
    .map((x) => ({ song: x.song, k: Math.pow(rand() || 1e-12, 1 / x.w) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.song)
}

/**
 * The next `count` radio songs, in strict tiers:
 *  1. songs sharing tags with the seed, until there are none left. More shared tags
 *     makes a song much likelier to come early, but isn't a strict order: tags often
 *     follow the artist, so that would play one artist's whole catalog in a row;
 *  2. songs with a similar genre tag (shoegaze → other rock);
 *  3. then a mix of everything else, leaning a little towards the seed's artist.
 * A seed with no tags has nothing to exhaust: its artist's songs come first, then the rest.
 */
export function radioFor(songs: Song[], seed: Song, exclude: Set<string>, count = 15, rand: () => number = Math.random, userTags: TagMap = {}, taste: RadioTaste = {}): Song[] {
  const { signals, likedIds, playlists = [], recent = [], now = Date.now() } = taste
  const stats = signals?.songs ?? {}
  const together = signals?.together[seed.id] ?? {}

  const tagsById = new Map(songs.map((s) => [s.id, tagsOf(s, userTags)]))
  const seedTags = tagsOf(seed, userTags)
  const seedKeys = new Set(seedTags.map(lc))
  const seedFamilies = new Set(seedTags.map(tagFamily).filter(Boolean))
  const seedArtists = new Set(songArtists(seed).map(lc))

  // Sharing a rare tag says more than sharing one on half your library.
  const tagCounts = new Map<string, number>()
  for (const key of seedKeys) tagCounts.set(key, 0)
  for (const tags of tagsById.values()) for (const t of tags) if (seedKeys.has(lc(t))) tagCounts.set(lc(t), (tagCounts.get(lc(t)) ?? 0) + 1)
  const rarity = (tag: string) => Math.log(1 + songs.length / Math.max(1, tagCounts.get(lc(tag)) ?? 1))

  // Being in a playlist together is a strong hint, more so in a small playlist.
  const playlistFit = new Map<string, number>()
  for (const p of playlists) {
    if (!p.songIds.includes(seed.id)) continue
    const fit = 6 / Math.sqrt(p.songIds.length)
    for (const id of p.songIds) playlistFit.set(id, (playlistFit.get(id) ?? 0) + fit)
  }

  const skippedArtists = new Set<string>()
  for (const s of songs) {
    const skippedAt = stats[s.id]?.lastSkippedAt ?? 0
    if (skippedAt && now - skippedAt < SESSION_SKIP_WINDOW) for (const a of songArtists(s)) skippedArtists.add(lc(a))
  }

  const score = (s: Song, shared: string[]): number => {
    const st = stats[s.id]
    const fit =
      1 +
      shared.reduce((sum, t) => sum + rarity(t) / 2, 0) +
      Math.min(4, playlistFit.get(s.id) ?? 0) +
      0.6 * Math.min(5, together[s.id] ?? 0) +
      (likedIds?.has(s.id) ? 1.5 : 0) +
      0.5 * Math.sqrt(Math.min(25, st?.plays ?? 0))
    const sessionSkip = songArtists(s).some((a) => skippedArtists.has(lc(a))) ? SESSION_SKIP_FACTOR : 1
    return fit * recencyFactor(st?.lastPlayedAt, now) * skipFactor(st?.plays ?? 0, st?.skips ?? 0) * sessionSkip
  }

  const sharing: { song: Song; w: number }[] = []
  const similar: { song: Song; w: number }[] = []
  const sameArtist: { song: Song; w: number }[] = []
  const rest: { song: Song; w: number }[] = []
  const allowLong = isLong(seed)
  for (const s of songs) {
    if (s.id === seed.id || exclude.has(s.id)) continue
    if (isLong(s) && !allowLong) continue
    const tags = tagsById.get(s.id) ?? []
    if (tags.some((t) => NEVER_ON_RADIO.has(lc(t))) && !seedTags.some((t) => NEVER_ON_RADIO.has(lc(t)))) continue
    const shared = tags.filter((t) => seedKeys.has(lc(t)))
    const w = score(s, shared)
    if (shared.length) sharing.push({ song: s, w: w * EXTRA_SHARED_TAG_WEIGHT ** (shared.length - 1) })
    else if (seedFamilies.size && tags.some((t) => seedFamilies.has(tagFamily(t)))) similar.push({ song: s, w })
    else if (songArtists(s).some((a) => seedArtists.has(lc(a)))) sameArtist.push({ song: s, w })
    else rest.push({ song: s, w })
  }

  const tiers = [sharing, similar]
  if (seedTags.length) tiers.push([...sameArtist.map((x) => ({ ...x, w: x.w * MIX_ARTIST_WEIGHT })), ...rest])
  else tiers.push(sameArtist, rest)

  // Sequencing.
  const heard = new Set([seed, ...songs.filter((s) => exclude.has(s.id))].map(versionKey))
  const out: Song[] = []
  const lastArtists = () => new Set([...recent, ...out].slice(-ARTIST_GAP).flatMap((s) => songArtists(s).map(lc)))
  for (const tier of tiers) {
    const pool = weightedOrder(tier, rand).filter((s) => !heard.has(versionKey(s)))
    while (out.length < count && pool.length) {
      const avoid = lastArtists()
      const clear = pool.findIndex((s) => !songArtists(s).some((a) => avoid.has(lc(a))))
      const [pick] = pool.splice(Math.max(0, clear), 1)
      const key = versionKey(pick)
      if (heard.has(key)) continue
      heard.add(key)
      out.push(pick)
    }
    if (out.length === count) break
  }
  return out
}
