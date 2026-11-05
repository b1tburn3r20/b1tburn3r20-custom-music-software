import { createRequire } from "module"
import fs from "fs"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const require = createRequire(import.meta.url)
const { createUserStore } = require("./user.cjs")

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "b1t-onboard-"))
  vi.spyOn(console, "info").mockImplementation(() => {})
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

const library = (over: Record<string, unknown> = {}) => ({ rootDir: null, visibleSongs: () => [], hasSong: () => true, pathToId: () => new Map(), ...over })
async function load(lib = library()) {
  const store = createUserStore({ userData: dir, library: lib, emit: () => {} })
  await store.load()
  return store
}
const writeUser = (settings: Record<string, unknown>) => fs.writeFileSync(path.join(dir, "user.json"), JSON.stringify({ version: 1, settings, playlists: [], likes: [] }))

describe("who sees onboarding", () => {
  it("a brand new user does", async () => {
    expect((await load()).settings.onboarding.status).toBe("pending")
  })

  it("an existing user with a music folder doesn't", async () => {
    writeUser({ theme: "dark" })
    expect((await load(library({ rootDir: "/music" }))).settings.onboarding.status).toBe("done")
  })

  it("an existing user with songs doesn't, even with no folder recorded", async () => {
    writeUser({})
    expect((await load(library({ visibleSongs: () => [{ id: "a" }] }))).settings.onboarding.status).toBe("done")
  })

  it("someone who left partway through carries on where they were", async () => {
    writeUser({ onboarding: { status: "pending", step: "youtube" } })
    expect((await load(library({ rootDir: "/music" }))).settings.onboarding).toEqual({ status: "pending", step: "youtube" })
  })

  it("someone who finished isn't asked again", async () => {
    writeUser({ onboarding: { status: "done", step: "welcome" } })
    expect((await load()).settings.onboarding.status).toBe("done")
  })

  it("an old install with a settings file but no music still gets it", async () => {
    writeUser({ theme: "dark" })
    expect((await load()).settings.onboarding.status).toBe("pending")
  })
})
