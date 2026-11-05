// Atomic, serialized JSON persistence.
// Every write goes to `<file>.tmp-<pid>` then is renamed over the target, so a
// crash mid-write can never leave a truncated file. Writes to the same file are
// chained so two concurrent saves can't interleave.
const fs = require("fs").promises;
const path = require("path");

const chains = new Map();

// Windows: antivirus and search indexers briefly hold files open, which makes a rename fail.
const RENAME_RETRY_CODES = new Set(["EPERM", "EBUSY", "EACCES"]);
const RENAME_RETRY_DELAYS_MS = [50, 100, 200, 400, 800];

async function renameWithRetry(from, to) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fs.rename(from, to);
    } catch (err) {
      if (!RENAME_RETRY_CODES.has(err.code) || attempt >= RENAME_RETRY_DELAYS_MS.length) throw err;
      await new Promise((r) => setTimeout(r, RENAME_RETRY_DELAYS_MS[attempt]));
    }
  }
}

async function writeFileAtomic(file, contents) {
  const prev = chains.get(file) || Promise.resolve();
  const next = prev
    .catch(() => { })
    .then(async () => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp-${process.pid}`;
      await fs.writeFile(tmp, contents, "utf-8");
      try {
        await renameWithRetry(tmp, file);
      } catch (err) {
        await fs.unlink(tmp).catch(() => { });
        throw err;
      }
    });
  chains.set(file, next);
  try {
    await next;
  } finally {
    if (chains.get(file) === next) chains.delete(file);
  }
}

function writeJsonAtomic(file, data) {
  return writeFileAtomic(file, JSON.stringify(data));
}

/** Returns parsed JSON, or `fallback` when the file doesn't exist. Throws on corrupt JSON. */
async function readJson(file, fallback = null) {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Debounced saver: collapses bursts of changes into one write. */
function createDebouncedSaver(saveFn, delayMs = 400) {
  let timer = null;
  let pending = null;
  const flush = async () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!pending) return;
    const p = pending;
    pending = null;
    // Always settle: whoever awaits schedule() must not hang forever because one save failed.
    try {
      await saveFn();
      p.resolve();
    } catch (err) {
      p.reject(err);
      throw err;
    }
  };
  const schedule = () => {
    if (!pending) {
      let resolve, reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      promise.catch(() => { }); // many callers don't await; the timer below logs the failure
      pending = { promise, resolve, reject };
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => flush().catch((e) => console.error("[store] save failed:", e)), delayMs);
    return pending.promise;
  };
  return { schedule, flush };
}

module.exports = { writeFileAtomic, writeJsonAtomic, readJson, exists, createDebouncedSaver };
