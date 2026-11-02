// Single source of truth for splitting an artist tag into individual artists.
// Previously this regex was copy-pasted 8 times across the handlers.
const SPLIT_RE = /,|&|\bfeat\.?(?=\s|$)|\bft\.?(?=\s|$)|\band\b/i;

function splitArtists(artist) {
  if (!artist || typeof artist !== "string") return [];
  const seen = new Set();
  const out = [];
  for (const part of artist.split(SPLIT_RE)) {
    const name = part.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (key === "unknown artist" || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

module.exports = { splitArtists };
