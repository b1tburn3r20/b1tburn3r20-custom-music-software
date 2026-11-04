// Atomic, serialized JSON persistence.
// Every write goes to `<file>.tmp-<pid>` then is renamed over the target, so a
// crash mid-write can never leave a truncated file. Writes to the same file are
// chained so two concurrent saves can't interleave.
const fs = require("fs").promises;
const path = require("path");

const chains = new Map();

async function writeFileAtomic(file, contents) {
  const prev = chains.get(file) || Promise.resolve();
  const next = prev
    .catch(() => { })
    .then(async () => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp-${process.pid}`;
      await fs.writeFile(tmp, contents, "utf-8");
      await fs.rename(tmp, file);
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
    await saveFn();
    p.resolve();
  };
  const schedule = () => {
    if (!pending) {
      let resolve;
      const promise = new Promise((r) => (resolve = r));
      pending = { promise, resolve };
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => flush().catch((e) => console.error("[store] save failed:", e)), delayMs);
    return pending.promise;
  };
  return { schedule, flush };
}

module.exports = { writeFileAtomic, writeJsonAtomic, readJson, exists, createDebouncedSaver };
