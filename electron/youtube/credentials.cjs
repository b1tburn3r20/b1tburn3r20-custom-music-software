// YouTube credentials the user pastes in, plus sign-in tokens. Nothing here ships with
// the app or lives in the repo. Values enter the main process and never come back out:
// the renderer only ever learns whether each one is set.
//
// Encrypted with the OS (Windows DPAPI, macOS Keychain, Linux keyring) via safeStorage.
// Linux without a keyring falls back to a key hard-coded in Chromium ("basic_text"), which
// isn't real protection, so there a value stays in memory unless the user accepts that.
const fs = require("fs").promises;
const path = require("path");
const { writeFileAtomic } = require("../lib/atomic.cjs");

const NAMES = new Set(["apiKey", "oauthClient", "oauthToken", "anthropicKey", "openaiKey"]);
const WEAK_BACKENDS = new Set(["basic_text", "unknown"]);

function createCredentialStore({ dir, safeStorage, platform = process.platform }) {
  const session = new Map(); // values held only until the app closes
  const unreadable = new Set();

  const fileFor = (name) => {
    if (!NAMES.has(name)) throw new Error(`Unknown credential "${name}"`);
    return path.join(dir, `youtube-${name}.enc`);
  };

  function secureStorage() {
    if (!safeStorage.isEncryptionAvailable()) return false;
    return platform !== "linux" || !WEAK_BACKENDS.has(safeStorage.getSelectedStorageBackend());
  }

  /** `allowWeak`: the user was told their system has no keyring and chose to save anyway. */
  async function set(name, value, { allowWeak = false } = {}) {
    const file = fileFor(name);
    unreadable.delete(name);
    if (!secureStorage() && !(allowWeak && safeStorage.isEncryptionAvailable())) {
      session.set(name, value);
      await fs.rm(file, { force: true });
      return { persisted: false };
    }
    session.delete(name);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFileAtomic(file, safeStorage.encryptString(value).toString("base64"));
    await fs.chmod(file, 0o600).catch(() => {}); // no effect on Windows, where DPAPI protects it
    return { persisted: true };
  }

  /** Returns null when not set, or when it can't be decrypted (e.g. Keychain access was lost). */
  async function get(name) {
    if (session.has(name)) return session.get(name);
    let stored;
    try {
      stored = await fs.readFile(fileFor(name), "utf-8");
    } catch (err) {
      if (err.code === "ENOENT") return null;
      throw err;
    }
    try {
      const value = safeStorage.decryptString(Buffer.from(stored, "base64"));
      unreadable.delete(name);
      return value;
    } catch (err) {
      // Reported through status() so the UI can ask for it again. The file stays: this
      // may be temporary, and it's overwritten as soon as the user enters a new value.
      console.warn(`[credentials] couldn't decrypt ${name}: ${err.message}`);
      unreadable.add(name);
      return null;
    }
  }

  async function has(name) {
    return (await get(name)) !== null;
  }

  async function remove(name) {
    session.delete(name);
    unreadable.delete(name);
    await fs.rm(fileFor(name), { force: true });
  }

  return { set, get, has, remove, secureStorage, unreadable: () => [...unreadable] };
}

module.exports = { createCredentialStore };
