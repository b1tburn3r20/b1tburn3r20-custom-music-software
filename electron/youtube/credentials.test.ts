import { createRequire } from "module"
import fs from "fs"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const require = createRequire(import.meta.url)
const { createCredentialStore } = require("./credentials.cjs")

const SECRET = "fake-very-secret-value"

/** Reversible but visibly not plaintext, like the real thing. */
function fakeSafeStorage({ available = true, backend = "gnome_libsecret" } = {}) {
  return {
    isEncryptionAvailable: () => available,
    getSelectedStorageBackend: () => backend,
    encryptString: (s: string) => Buffer.from(s).map((b) => b ^ 0x5a),
    decryptString: (b: Buffer) => Buffer.from(b.map((x) => x ^ 0x5a)).toString(),
  }
}

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "b1t-creds-"))
  vi.spyOn(console, "warn").mockImplementation(() => {})
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

const everythingOnDisk = () => fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf-8")).join("\n")

describe("with OS encryption", () => {
  const make = (platform = "win32") => createCredentialStore({ dir, safeStorage: fakeSafeStorage(), platform })

  it("round-trips a value across app restarts", async () => {
    await make().set("apiKey", SECRET)
    expect(await make().get("apiKey")).toBe(SECRET)
  })

  it("never writes the value in plaintext", async () => {
    const r = await make().set("apiKey", SECRET)
    expect(r.persisted).toBe(true)
    expect(everythingOnDisk()).not.toContain(SECRET)
    expect(everythingOnDisk().length).toBeGreaterThan(0)
  })

  it("removes it completely", async () => {
    const s = make()
    await s.set("apiKey", SECRET)
    await s.remove("apiKey")
    expect(await s.get("apiKey")).toBeNull()
    expect(fs.readdirSync(dir)).toEqual([])
  })

  it("reports nothing set for a credential never entered", async () => {
    expect(await make().get("apiKey")).toBeNull()
    expect(await make().has("oauthToken")).toBe(false)
  })

  it("rejects unknown names rather than writing arbitrary files", async () => {
    await expect(make().set("../../evil", "x")).rejects.toThrow(/Unknown credential/)
  })

  it("asks for re-entry when decryption fails, without crashing or deleting", async () => {
    await make().set("apiKey", SECRET)
    const broken = { ...fakeSafeStorage(), decryptString: () => { throw new Error("Keychain access denied") } }
    const s = createCredentialStore({ dir, safeStorage: broken, platform: "darwin" })
    expect(await s.get("apiKey")).toBeNull()
    expect(s.unreadable()).toEqual(["apiKey"])
    expect(fs.readdirSync(dir)).toHaveLength(1)
    await make().set("apiKey", "new")
    expect(await make().get("apiKey")).toBe("new")
  })
})

describe("on Linux with no keyring", () => {
  const make = () => createCredentialStore({ dir, safeStorage: fakeSafeStorage({ backend: "basic_text" }), platform: "linux" })

  it("says storage isn't secure", () => {
    expect(make().secureStorage()).toBe(false)
  })

  it("keeps the value in memory only, by default", async () => {
    const s = make()
    expect(await s.set("apiKey", SECRET)).toEqual({ persisted: false })
    expect(await s.get("apiKey")).toBe(SECRET)
    expect(fs.readdirSync(dir)).toEqual([])
    expect(await make().get("apiKey")).toBeNull() // gone after a restart
  })

  it("saves only when the user explicitly accepts that", async () => {
    const r = await make().set("apiKey", SECRET, { allowWeak: true })
    expect(r.persisted).toBe(true)
    expect(await make().get("apiKey")).toBe(SECRET)
  })

  it("removes an earlier file when falling back to memory", async () => {
    await make().set("apiKey", "old", { allowWeak: true })
    await make().set("apiKey", SECRET)
    expect(fs.readdirSync(dir)).toEqual([])
  })
})

describe("secureStorage", () => {
  it("trusts a real Linux keyring", () => {
    const s = createCredentialStore({ dir, safeStorage: fakeSafeStorage({ backend: "kwallet6" }), platform: "linux" })
    expect(s.secureStorage()).toBe(true)
  })
  it("is false when the OS offers no encryption at all, even if weak storage is accepted", async () => {
    const s = createCredentialStore({ dir, safeStorage: fakeSafeStorage({ available: false }), platform: "win32" })
    expect(s.secureStorage()).toBe(false)
    expect(await s.set("apiKey", SECRET, { allowWeak: true })).toEqual({ persisted: false })
  })
})
