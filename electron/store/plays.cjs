// Listening history: append-only plays.jsonl (one JSON event per line).
// Event: { id, songId, startedAt, endedAt, listenedMs, durationMs, counted, context }
// "counted" = a real play (listened ≥ min(30 s, 50% of the track)); listenedMs
// counts actual listening time only (seeks and pauses are excluded by the player).
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const { writeFileAtomic } = require("../lib/atomic.cjs");

const DAY = 24 * 60 * 60 * 1000;
const RANGES = { week: 7 * DAY, month: 30 * DAY, all: Infinity };

function sanitizeEvent(e) {
  const num = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
  if (!e || typeof e.songId !== "string" || !e.songId) return null;
  const listenedMs = num(e.listenedMs);
  if (listenedMs < 1000) return null; // skips/accidental clicks aren't history
  return {
    id: crypto.randomUUID(),
    songId: e.songId,
    startedAt: num(e.startedAt) || Date.now() - listenedMs,
    endedAt: num(e.endedAt) || Date.now(),
    listenedMs: Math.min(listenedMs, 6 * 60 * 60 * 1000),
    durationMs: num(e.durationMs),
    counted: Boolean(e.counted),
    context: e.context && typeof e.context === "object" ? { type: String(e.context.type || ""), id: e.context.id ? String(e.context.id) : undefined } : null,
  };
}

/** Pure aggregation, unit tested. `songInfo(id)` → { artists: string[] } | null (deleted songs are skipped). */
function aggregate(events, { range = "all", now = Date.now(), songInfo, limit = 50 }) {
  const since = range in RANGES ? now - RANGES[range] : 0;
  const inRange = events.filter((e) => e.endedAt >= since);
  const songs = new Map();
  const artists = new Map();
  const days = new Map();
  let totalMs = 0;
  let plays = 0;
  for (const e of inRange) {
    const info = songInfo(e.songId);
    if (!info) continue;
    totalMs += e.listenedMs;
    if (e.counted) plays++;
    const s = songs.get(e.songId) || { songId: e.songId, plays: 0, ms: 0, lastPlayedAt: 0 };
    s.ms += e.listenedMs;
    if (e.counted) s.plays++;
    s.lastPlayedAt = Math.max(s.lastPlayedAt, e.endedAt);
    songs.set(e.songId, s);
    for (const a of info.artists.length ? info.artists : ["Unknown artist"]) {
      const k = a.toLowerCase();
      const r = artists.get(k) || { name: a, plays: 0, ms: 0, songs: new Set() };
      r.ms += e.listenedMs;
      if (e.counted) r.plays++;
      r.songs.add(e.songId);
      artists.set(k, r);
    }
    const day = new Date(e.endedAt);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    days.set(key, (days.get(key) || 0) + e.listenedMs);
  }
  const byPlays = (a, b) => b.plays - a.plays || b.ms - a.ms;
  return {
    range,
    since: Number.isFinite(since) ? since : null,
    totalMs,
    plays,
    uniqueSongs: songs.size,
    uniqueArtists: artists.size,
    topSongs: [...songs.values()].sort(byPlays).slice(0, limit),
    topArtists: [...artists.values()].map((a) => ({ name: a.name, plays: a.plays, ms: a.ms, songCount: a.songs.size })).sort(byPlays).slice(0, limit),
    daily: [...days.entries()].map(([day, ms]) => ({ day, ms })).sort((a, b) => a.day.localeCompare(b.day)),
  };
}

function forgottenFrom(events, { minPlays, olderThanDays, limit, now, songInfo }) {
  const bySong = new Map();
  for (const e of events) {
    const r = bySong.get(e.songId) || { songId: e.songId, plays: 0, ms: 0, lastPlayedAt: 0 };
    if (e.counted) r.plays++;
    r.ms += e.listenedMs;
    r.lastPlayedAt = Math.max(r.lastPlayedAt, e.endedAt);
    bySong.set(e.songId, r);
  }
  const cutoff = now - olderThanDays * DAY;
  return [...bySong.values()]
    .filter((r) => r.plays > minPlays && r.lastPlayedAt < cutoff && songInfo(r.songId))
    .sort((a, b) => b.plays - a.plays || a.lastPlayedAt - b.lastPlayedAt)
    .slice(0, limit);
}

const SESSION_GAP = 30 * 60 * 1000;
const TOGETHER_WINDOW = 4;
const TOGETHER_LIMIT = 25;
const SKIP_UNDER_MS = 30_000;

/**
 * What radio learns from your listening. Per song: plays, skips (given up on within
 * 30 s) and when. "together": songs you chose to hear close to each other in a
 * session. Radio's own suggestions don't count, or it would only reinforce itself.
 */
function radioSignalsFrom(events, { songInfo }) {
  const songs = {};
  const sorted = [...events].filter((e) => songInfo(e.songId)).sort((a, b) => a.endedAt - b.endedAt);
  const counts = new Map();
  const bump = (a, b) => {
    const m = counts.get(a) || new Map();
    m.set(b, (m.get(b) || 0) + 1);
    counts.set(a, m);
  };
  let window = [];
  for (const e of sorted) {
    const s = (songs[e.songId] ||= { plays: 0, skips: 0, lastPlayedAt: 0, lastSkippedAt: 0 });
    if (e.counted) s.plays++;
    else if (e.listenedMs < SKIP_UNDER_MS) {
      s.skips++;
      s.lastSkippedAt = Math.max(s.lastSkippedAt, e.endedAt);
    }
    s.lastPlayedAt = Math.max(s.lastPlayedAt, e.endedAt);
    if (!e.counted || e.context?.type === "radio") continue;
    window = window.filter((w) => e.endedAt - w.endedAt < SESSION_GAP).slice(-TOGETHER_WINDOW);
    for (const w of window) {
      if (w.songId === e.songId) continue;
      bump(w.songId, e.songId);
      bump(e.songId, w.songId);
    }
    window.push(e);
  }
  const together = {};
  for (const [id, m] of counts) {
    together[id] = Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOGETHER_LIMIT));
  }
  return { songs, together };
}

function createPlaysStore({ userData, songInfo }) {
  const file = path.join(userData, "plays.jsonl");
  let events = [];
  let cache = new Map();

  async function load() {
    let raw = "";
    try {
      raw = await fs.readFile(file, "utf-8");
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
    let bad = 0;
    events = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line));
      } catch {
        bad++; // a torn last line after a crash; keep everything else
      }
    }
    if (bad) console.warn(`[plays] skipped ${bad} unreadable line(s) in plays.jsonl`);
    return { events: events.length };
  }

  async function record(e) {
    const ev = sanitizeEvent(e);
    if (!ev) return null;
    events.push(ev);
    cache = new Map();
    await fs.appendFile(file, JSON.stringify(ev) + "\n", "utf-8");
    return ev;
  }

  async function purgeSongs(ids) {
    const set = new Set(ids);
    const before = events.length;
    events = events.filter((e) => !set.has(e.songId));
    if (events.length === before) return 0;
    cache = new Map();
    await writeFileAtomic(file, events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : ""));
    return before - events.length;
  }

  function stats(range = "all") {
    const key = range;
    if (!cache.has(key)) cache.set(key, aggregate(events, { range, songInfo }));
    return cache.get(key);
  }

  /** Most recent listening sessions first. */
  function history({ limit = 200, before = Infinity } = {}) {
    const out = [];
    for (let i = events.length - 1; i >= 0 && out.length < limit; i--) {
      const e = events[i];
      if (e.endedAt < before && songInfo(e.songId)) out.push({ id: e.id, songId: e.songId, endedAt: e.endedAt, listenedMs: e.listenedMs, counted: e.counted });
    }
    return out;
  }

  const invalidate = () => (cache = new Map());

  /**
   * Forgotten favorites: songs you played more than `minPlays` times (counted
   * plays, all time) but not in the last `olderThanDays` days. Most-played first.
   */
  function forgotten({ minPlays = 10, olderThanDays = 30, limit = 50, now = Date.now() } = {}) {
    return forgottenFrom(events, { minPlays, olderThanDays, limit, now, songInfo });
  }

  function radioSignals() {
    if (!cache.has("radio-signals")) cache.set("radio-signals", radioSignalsFrom(events, { songInfo }));
    return cache.get("radio-signals");
  }

  return { load, record, purgeSongs, stats, history, invalidate, forgotten, radioSignals };
}

module.exports = { createPlaysStore, aggregate, sanitizeEvent, forgottenFrom, radioSignalsFrom };
