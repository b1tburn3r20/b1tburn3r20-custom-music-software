// A local snapshot of the user's YouTube data: their playlists, likes and subscriptions.
// YouTube's API policy (III.E.4) allows this for at most 30 days without a refresh, so the
// limit is enforced on load, before anything is read, even if the sign-in has since ended.
const fs = require("fs").promises;
const path = require("path");
const { readJson, writeJsonAtomic } = require("../lib/atomic.cjs");

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;
const EMPTY = { fetchedAt: null, channel: null, playlists: [], liked: [], subscriptions: [], appliedLikes: [], dismissed: [] };

function createYoutubeAccountStore({ userData, now = Date.now }) {
  const file = path.join(userData, "youtube-account.json");
  let state = { ...EMPTY };

  async function load() {
    let saved = null;
    try {
      saved = await readJson(file);
    } catch (err) {
      console.warn(`[youtube-account] ignoring an unreadable snapshot: ${err.message}`);
      await fs.rm(file, { force: true });
    }
    if (saved && saved.fetchedAt && now() - saved.fetchedAt > MAX_AGE_MS) {
      // appliedLikes and dismissed are the user's own choices here, not YouTube's data.
      state = { ...EMPTY, appliedLikes: saved.appliedLikes || [], dismissed: saved.dismissed || [] };
      await save();
      return { purged: true };
    }
    state = { ...EMPTY, ...(saved || {}) };
    return { purged: false };
  }

  function save() {
    return writeJsonAtomic(file, state);
  }

  async function update(patch) {
    state = { ...state, ...patch, fetchedAt: now() };
    await save();
    return state;
  }

  /** On disconnect: YouTube's data goes, and so does the record of what was applied from it. */
  async function clear() {
    state = { ...EMPTY };
    await fs.rm(file, { force: true });
  }

  async function dismiss(id) {
    if (state.dismissed.includes(id)) return state;
    state = { ...state, dismissed: [...state.dismissed, id] };
    await save();
    return state;
  }

  /**
   * Which of these liked videos haven't been turned into a local like yet, recording them
   * as done. Each is applied only once, so unliking a song here is never undone by a sync.
   */
  async function takeUnappliedLikes(videoIds) {
    const applied = new Set(state.appliedLikes);
    const fresh = videoIds.filter((id) => !applied.has(id));
    if (fresh.length) {
      state = { ...state, appliedLikes: [...state.appliedLikes, ...fresh] };
      await save();
    }
    return fresh;
  }

  return {
    load,
    update,
    clear,
    dismiss,
    takeUnappliedLikes,
    get: () => state,
    isStale: () => !state.fetchedAt || now() - state.fetchedAt > REFRESH_AFTER_MS,
  };
}

module.exports = { createYoutubeAccountStore, MAX_AGE_MS, REFRESH_AFTER_MS };
