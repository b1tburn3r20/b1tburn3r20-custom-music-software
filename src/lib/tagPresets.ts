// The standard genre names offered when tagging, so the same genre doesn't end up
// under several spellings ("hip hop", "hip-hop", "hiphop"). Lowercase like your tags.

const MOODS = "Mood and vibe"
const MOMENTS = "Moments"
const OTHER = "Other"

export const GENRE_GROUPS: { label: string; genres: string[] }[] = [
  { label: MOODS, genres: ["chill", "mellow", "relaxing", "calm", "peaceful", "cozy", "upbeat", "happy", "feel-good", "uplifting", "playful", "groovy", "sad", "melancholy", "bittersweet", "heartbreak", "lonely", "romantic", "sensual", "energetic", "hype", "empowering", "aggressive", "angry", "dark", "moody", "dreamy", "ethereal", "epic", "cinematic", "nostalgic"] },
  { label: MOMENTS, genres: ["party", "pregame", "workout", "running", "driving", "road trip", "gaming", "focus", "study", "cooking", "morning", "late night", "sleep", "summer", "winter", "rainy day", "throwback", "christmas", "halloween"] },
  { label: "Rock", genres: ["rock", "alternative rock", "indie rock", "hard rock", "classic rock", "soft rock", "rock and roll", "blues rock", "folk rock", "punk", "hardcore punk", "pop punk", "post-punk", "post-hardcore", "emo", "midwest emo", "grunge", "shoegaze", "post-rock", "math rock", "noise rock", "progressive rock", "psychedelic rock", "garage rock", "stoner rock", "surf rock"] },
  { label: "Metal", genres: ["metal", "heavy metal", "metalcore", "deathcore", "hardcore", "death metal", "black metal", "thrash metal", "doom metal", "nu metal", "progressive metal", "power metal", "symphonic metal", "groove metal", "industrial metal", "sludge metal", "folk metal", "djent"] },
  { label: "Hip hop", genres: ["hip hop", "rap", "trap", "drill", "uk drill", "boom bap", "old school hip hop", "conscious rap", "gangsta rap", "melodic rap", "pop rap", "jazz rap", "cloud rap", "emo rap", "rage", "phonk", "grime", "lo-fi hip hop"] },
  { label: "Pop", genres: ["pop", "indie pop", "pop rock", "power pop", "synth-pop", "dream pop", "electropop", "dance pop", "art pop", "bedroom pop", "hyperpop", "latin pop", "k-pop", "j-pop", "c-pop", "city pop"] },
  { label: "R&B and soul", genres: ["r&b", "contemporary r&b", "alternative r&b", "soul", "neo soul", "motown", "doo-wop", "new jack swing", "funk", "disco", "gospel"] },
  { label: "Electronic", genres: ["electronic", "edm", "house", "deep house", "tech house", "progressive house", "future house", "techno", "melodic techno", "minimal techno", "trance", "psytrance", "dubstep", "drum and bass", "jungle", "footwork", "uk garage", "breakbeat", "breakcore", "hardstyle", "future bass", "electro", "idm", "glitch", "ambient", "downtempo", "trip hop", "lo-fi", "synthwave", "vaporwave", "chillwave", "nightcore"] },
  { label: "Jazz and blues", genres: ["jazz", "smooth jazz", "bebop", "jazz fusion", "swing", "blues", "delta blues"] },
  { label: "Country and folk", genres: ["country", "country pop", "outlaw country", "americana", "bluegrass", "folk", "indie folk", "singer-songwriter"] },
  { label: "Reggae and Latin", genres: ["reggae", "dub", "dancehall", "ska", "reggaeton", "latin", "salsa", "bachata", "cumbia", "corridos", "bossa nova"] },
  { label: OTHER, genres: ["classical", "opera", "acoustic", "instrumental", "afrobeats", "amapiano", "world", "soundtrack", "video game music", "anime", "musical theatre", "spoken word"] },
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
  punkrock: "punk",
  rocknroll: "rock and roll",
  triphop: "trip hop",
  musical: "musical theatre",
  musicaltheater: "musical theatre",
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

// "Other" is just the rest of the list, and moods and moments can go with any kind of music.
const NOT_FAMILIES = new Set([OTHER, MOODS, MOMENTS])
const FAMILY_BY_KEY = new Map<string, string>(GENRE_GROUPS.filter((g) => !NOT_FAMILIES.has(g.label)).flatMap((g) => g.genres.map((name) => [looseKey(name), g.label] as [string, string])))

/** The genre family a tag belongs to, also for your own variants ("chill rap" → Hip hop). Moods have none. */
export function tagFamily(tag: string): string | null {
  return FAMILY_BY_KEY.get(looseKey(tag)) ?? FAMILY_BY_KEY.get(looseKey(tag.trim().split(/\s+/).pop() ?? "")) ?? null
}
