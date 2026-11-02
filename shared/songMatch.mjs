// Decides whether a YouTube video is a song you already have, for songs that
// were downloaded before YouTube ids were recorded. Shared by the main process
// (download skipping) and the UI ("In library" badges). A title alone is never
// enough: two different songs called "JUMP" must stay separate.

const NOISE = /\b(official|video|audio|lyrics?|lyric video|visuali[sz]er|music video|hd|hq|4k|mv|m\/v|remaster(ed)?|explicit|clean|full song|color coded)\b/i

function stripNoise(s) {
  return String(s || "")
    .replace(/\(([^)]*)\)|\[([^\]]*)\]|【([^】]*)】/g, (m, a, b, c) => (NOISE.test(a || b || c || "") ? " " : m))
    .replace(/\s+(ft\.?|feat\.?|featuring)\s+.*$/i, " ")
    .replace(/\((ft\.?|feat\.?|featuring)\s+[^)]*\)/gi, " ")
}

const fold = (s) =>
  String(s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()

/** "Artist - Title (Official Video) [HD]" → { artist: "artist", title: "title" } */
export function parseVideoTitle(videoTitle) {
  const cleaned = stripNoise(videoTitle)
  const m = /^(.+?)\s+[-–—|]\s+(.+)$/.exec(cleaned)
  return m ? { artist: fold(m[1]), title: fold(stripNoise(m[2])) } : { artist: "", title: fold(cleaned) }
}

export const normalizeSongTitle = (t) => fold(stripNoise(t))

function channelName(channel) {
  return fold(String(channel || "").replace(/\s*-\s*topic$/i, "").replace(/vevo$/i, ""))
}

/** Does any of the song's artists appear in the video's channel or "Artist - …" prefix? */
function artistEvidence(song, video, parsed) {
  const haystack = ` ${channelName(video.channel)} ${parsed.artist} ${fold(video.title)} `
  const artists = (song.artists && song.artists.length ? song.artists : [song.artist]).map(fold).filter((a) => a && a !== "unknown artist")
  if (!artists.length) return false
  return artists.some((a) => haystack.includes(` ${a} `) || (a.length >= 4 && haystack.includes(a)))
}

/**
 * Is `song` (library metadata: { title, artist, artists, duration }) the same recording
 * as `video` ({ title, channel, duration })? Requires matching title, artist evidence,
 * and — when both lengths are known — durations within 3 seconds.
 */
export function isSameSong(song, video) {
  const parsed = parseVideoTitle(video.title)
  const songTitle = normalizeSongTitle(song.title)
  if (!songTitle || (songTitle !== parsed.title && songTitle !== fold(stripNoise(video.title)))) return false
  if (!artistEvidence(song, video, parsed)) return false
  const a = Number(song.duration) || 0
  const b = Number(video.duration) || 0
  if (a > 0 && b > 0 && Math.abs(a - b) > 3) return false
  return true
}

/**
 * Find the library song for a video: exact YouTube id first; otherwise the single
 * id-less song that isSameSong() accepts. Ambiguous or weak matches return null.
 */
export function findOwnedSong(songs, video, getMeta = (s) => s.metadata) {
  const exact = songs.find((s) => s.sourceId === video.id)
  if (exact) return { song: exact, exact: true }
  const candidates = songs.filter((s) => !s.sourceId && getMeta(s) && isSameSong(getMeta(s), video))
  return candidates.length === 1 ? { song: candidates[0], exact: false } : null
}
