// Audio file helpers: metadata parsing, cover extraction and fingerprinting.
// (Previously duplicated between fileSystemHandlers and downloadHandlers.)
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const { splitArtists } = require("./artists.cjs");

const AUDIO_EXT_RE = /\.mp3$/i;
const FP_CHUNK = 64 * 1024;

let mmPromise = null;
function loadMusicMetadata() {
  if (!mmPromise) mmPromise = Promise.resolve().then(() => require("music-metadata"));
  return mmPromise;
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0 || !Number.isFinite(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/**
 * Content fingerprint used to re-link a song whose file was renamed or moved:
 * file size + sha1 of the first and last 64 KB. Cheap (≤128 KB read) and
 * stable across renames.
 */
async function fingerprintFile(filePath, size) {
  const fh = await fs.open(filePath, "r");
  try {
    const total = size ?? (await fh.stat()).size;
    const hash = crypto.createHash("sha1");
    const headLen = Math.min(FP_CHUNK, total);
    const head = Buffer.alloc(headLen);
    await fh.read(head, 0, headLen, 0);
    hash.update(head);
    if (total > FP_CHUNK) {
      const tailLen = Math.min(FP_CHUNK, total - FP_CHUNK);
      const tail = Buffer.alloc(tailLen);
      await fh.read(tail, 0, tailLen, total - tailLen);
      hash.update(tail);
    }
    return `${total}:${hash.digest("hex")}`;
  } finally {
    await fh.close();
  }
}

/**
 * Parses tags once and (optionally) writes the embedded cover to `coverOut`.
 * Never throws: falls back to filename-derived metadata.
 */
async function readAudioMetadata(filePath, coverOut = null) {
  const base = path.basename(filePath).replace(AUDIO_EXT_RE, "");
  try {
    const mm = await loadMusicMetadata();
    const meta = await mm.parseFile(filePath, { skipCovers: !coverOut });
    const c = meta.common;
    let hasCover = false;
    if (coverOut && c.picture && c.picture.length > 0) {
      const pic = c.picture[0];
      if (/^image\/(jpeg|png|webp)$/.test(pic.format)) {
        await fs.mkdir(path.dirname(coverOut), { recursive: true });
        await fs.writeFile(coverOut, pic.data);
        hasCover = true;
      }
    }
    const artist = c.artist || (c.artists && c.artists[0]) || "Unknown Artist";
    const duration = meta.format.duration || 0;
    return {
      hasCover,
      metadata: {
        title: c.title || base,
        artist,
        artists: splitArtists(artist),
        album: c.album || null,
        albumArtist: c.albumartist || null,
        duration,
        durationFormatted: formatDuration(duration),
        year: c.year || null,
        genre: (c.genre && c.genre[0]) || null,
        description: (c.comment && (c.comment[0]?.text ?? c.comment[0])) || "",
        uploadDate: c.date || "",
      },
    };
  } catch (err) {
    console.warn(`[media] could not read tags for ${path.basename(filePath)}: ${err.message}`);
    return {
      hasCover: false,
      metadata: {
        title: base,
        artist: "Unknown Artist",
        artists: [],
        album: null,
        albumArtist: null,
        duration: 0,
        durationFormatted: "0:00",
        year: null,
        genre: null,
        description: "",
        uploadDate: "",
      },
    };
  }
}

/** Extracts a YouTube video id from a "Title [abcdefghijk].mp3" filename, if present. */
function sourceIdFromFileName(fileName) {
  const m = /\[([A-Za-z0-9_-]{11})\]\.[a-z0-9]+$/i.exec(fileName);
  return m ? m[1] : null;
}

module.exports = {
  AUDIO_EXT_RE,
  formatDuration,
  fingerprintFile,
  readAudioMetadata,
  sourceIdFromFileName,
};
