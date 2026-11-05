import { createRequire } from "module"
import fs from "fs"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const require = createRequire(import.meta.url)
const { defaultMusicFolder, ensureDefaultFolder } = require("./musicFolder.cjs")

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "b1t-music-"))
  vi.spyOn(console, "warn").mockImplementation(() => {})
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function fakeLibrary(rootDir: string | null = null) {
  return {
    rootDir,
    scan: vi.fn(async function (this: { rootDir: string | null }, root: string) {
      this.rootDir = root
      return { added: 0, total: 0 }
    }),
  }
}

describe("defaultMusicFolder", () => {
  it("uses the OS Music folder, including a redirected one", () => {
    expect(defaultMusicFolder(() => "D:\\OneDrive\\Music", "C:\\Users\\me")).toBe("D:\\OneDrive\\Music")
  })
  it("falls back to ~/Music when the OS defines none", () => {
    const failing = () => {
      throw new Error("Failed to get 'music' path")
    }
    expect(defaultMusicFolder(failing, dir)).toBe(path.join(dir, "Music"))
    expect(defaultMusicFolder(() => "", dir)).toBe(path.join(dir, "Music"))
  })
})

describe("ensureDefaultFolder", () => {
  it("sets the OS Music folder for someone with no folder yet", async () => {
    const library = fakeLibrary()
    const music = path.join(dir, "Music")
    const r = await ensureDefaultFolder({ library, getPath: () => music })
    expect(r).toMatchObject({ applied: true, rootDir: music })
    expect(library.scan).toHaveBeenCalledWith(music)
  })

  it("creates the folder if it doesn't exist", async () => {
    const music = path.join(dir, "not", "yet", "there")
    await ensureDefaultFolder({ library: fakeLibrary(), getPath: () => music })
    expect(fs.existsSync(music)).toBe(true)
  })

  it("never replaces a folder that's already set, such as one from legacy import", async () => {
    const library = fakeLibrary("/home/me/old-music")
    const r = await ensureDefaultFolder({ library, getPath: () => path.join(dir, "Music") })
    expect(r).toEqual({ applied: false, rootDir: "/home/me/old-music" })
    expect(library.scan).not.toHaveBeenCalled()
  })

  it("reports a folder it can't use, instead of stopping the app", async () => {
    const library = fakeLibrary()
    library.scan.mockRejectedValue(new Error("EACCES: permission denied"))
    const r = await ensureDefaultFolder({ library, getPath: () => path.join(dir, "Music") })
    expect(r).toMatchObject({ applied: false, rootDir: null, error: expect.stringContaining("EACCES") })
  })
})
