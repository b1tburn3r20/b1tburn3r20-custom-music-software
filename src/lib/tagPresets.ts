// The standard genre names offered when tagging, so the same genre doesn't end up
// under several spellings ("hip hop", "hip-hop", "hiphop"). Lowercase like your tags.

export const GENRE_GROUPS: { label: string; genres: string[] }[] = [
  { label: "Rock", genres: ["rock", "alternative rock", "indie rock", "hard rock", "classic rock", "punk", "pop punk", "post-punk", "post-hardcore", "emo", "grunge", "shoegaze", "post-rock", "progressive rock", "psychedelic rock", "garage rock"] },
  { label: "Metal", genres: ["metal", "heavy metal", "metalcore", "deathcore", "hardcore", "death metal", "black metal", "thrash metal", "doom metal", "nu metal", "progressive metal", "djent"] },
  { label: "Hip hop", genres: ["hip hop", "rap", "trap", "drill", "boom bap", "cloud rap", "emo rap", "rage", "phonk", "grime", "lo-fi hip hop"] },
  { label: "Pop", genres: ["pop", "indie pop", "synth-pop", "dream pop", "electropop", "dance pop", "art pop", "bedroom pop", "hyperpop", "k-pop", "j-pop", "city pop"] },
  { label: "R&B and soul", genres: ["r&b", "soul", "neo soul", "funk", "disco", "gospel"] },
  { label: "Electronic", genres: ["electronic", "edm", "house", "deep house", "techno", "trance", "dubstep", "drum and bass", "uk garage", "breakbeat", "breakcore", "hardstyle", "future bass", "electro", "idm", "glitch", "ambient", "downtempo", "lo-fi", "synthwave", "vaporwave", "chillwave", "nightcore"] },
  { label: "Other", genres: ["jazz", "blues", "classical", "country", "folk", "indie folk", "singer-songwriter", "acoustic", "instrumental", "reggae", "dancehall", "ska", "reggaeton", "latin", "afrobeats", "bossa nova", "world", "soundtrack", "video game music", "anime"] },
]

/** Spacing, hyphens, "&" and case don't make a different tag. */
export const looseKey = (tag: string) =>
  tag
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]/gu, "")

const ALIASES: Record<string, string> = {
  rnb: "r&b",
  rhythmandblues: "r&b",
  dnb: "drum and bass",
  drumnbass: "drum and bass",
  altrock: "alternative rock",
  progrock: "progressive rock",
  psychrock: "psychedelic rock",
  progmetal: "progressive metal",
  numetal: "nu metal",
  hiphoprap: "hip hop",
  ost: "soundtrack",
  vgm: "video game music",
  gamemusic: "video game music",
  electronica: "electronic",
  afrobeat: "afrobeats",
  ukg: "uk garage",
  lofihiphop: "lo-fi hip hop",
}

const PRESET_BY_KEY = new Map<string, string>(GENRE_GROUPS.flatMap((g) => g.genres).map((name) => [looseKey(name), name]))

/**
 * The name a typed tag should be saved under: a spelling you already use wins, then
 * the standard genre name, otherwise what you typed (new tags are always allowed).
 */
export function canonicalTag(input: string, own: readonly string[] = []): string {
  const typed = input.trim().replace(/\s+/g, " ")
  const key = looseKey(typed)
  if (!key) return typed
  const preset = PRESET_BY_KEY.get(ALIASES[key] ? looseKey(ALIASES[key]) : key)
  const targets = [key, ...(preset ? [looseKey(preset)] : [])]
  return own.find((t) => targets.includes(looseKey(t))) ?? preset ?? typed
}

/** Edit distance, stopping early once it can't be within `max`. */
function withinEdits(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    if (Math.min(...row) > max) return false
    prev = row
  }
  return prev[b.length] <= max
}

/** Does this tag fit what's being typed? Includes near misses, so typos still find the real name. */
export function tagMatches(tag: string, query: string): boolean {
  const q = looseKey(query)
  if (!q) return true
  const key = looseKey(tag)
  if (key.includes(q)) return true
  return q.length >= 4 && withinEdits(key, q, q.length >= 7 ? 2 : 1)
}

/**
 * A known name this is probably a typo of ("electornic" → "electronic"), for asking
 * before a misspelling becomes a tag. Null when it's not close to anything, or is exact.
 */
export function likelyTypoOf(input: string, names: readonly string[]): string | null {
  const q = looseKey(input)
  if (q.length < 4) return null
  const keys = names.map(looseKey)
  if (keys.includes(q)) return null
  const i = keys.findIndex((k) => !k.includes(q) && withinEdits(k, q, q.length >= 7 ? 2 : 1))
  return i < 0 ? null : names[i]
}

// "Other" is just the rest of the list: jazz and country aren't related.
const FAMILY_BY_KEY = new Map<string, string>(GENRE_GROUPS.filter((g) => g.label !== "Other").flatMap((g) => g.genres.map((name) => [looseKey(name), g.label] as [string, string])))

/** The genre family a tag belongs to, also for your own variants ("chill rap" → Hip hop). Moods have none. */
export function tagFamily(tag: string): string | null {
  return FAMILY_BY_KEY.get(looseKey(tag)) ?? FAMILY_BY_KEY.get(looseKey(tag.trim().split(/\s+/).pop() ?? "")) ?? null
}
