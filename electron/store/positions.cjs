// Last playback position of long tracks (audiobooks, mixes): positions.json
// { [songId]: { pos, at } }. Kept separate from user.json so the frequent saves
// don't rewrite (or broadcast) the whole user state.
const path = require("path");
const { readJson, writeJsonAtomic, createDebouncedSaver } = require("../lib/atomic.cjs");

function createPositionsStore({ userData }) {
  const file = path.join(userData, "positions.json");
  let positions = {};
  const saver = createDebouncedSaver(() => writeJsonAtomic(file, positions), 2000);

  async function load() {
    try {
      positions = (await readJson(file, {})) || {};
    } catch (err) {
      console.warn("[positions] positions.json unreadable, starting fresh:", err.message);
      positions = {};
    }
  }
  const get = (songId) => (positions[songId] ? positions[songId].pos : null);
  function set(songId, pos) {
    if (typeof songId !== "string") return;
    if (pos == null) {
      if (!positions[songId]) return;
      delete positions[songId];
    } else positions[songId] = { pos: Math.max(0, Math.floor(Number(pos) || 0)), at: Date.now() };
    saver.schedule();
  }
  function purgeSongs(ids) {
    let changed = false;
    for (const id of ids) if (positions[id]) (delete positions[id], (changed = true));
    if (changed) saver.schedule();
  }
  return { load, get, set, purgeSongs, flush: () => saver.flush() };
}

module.exports = { createPositionsStore };
