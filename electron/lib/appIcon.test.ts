import { createRequire } from "module"
import fs from "fs"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const require = createRequire(import.meta.url)
const icon = require("./appIcon.cjs")

/** Just enough of a PNG for its header to be read. */
function pngHeader(width: number, height: number) {
  const b = Buffer.alloc(24)
  Buffer.from("89504e470d0a1a0a", "hex").copy(b)
  b.writeUInt32BE(width, 16)
  b.writeUInt32BE(height, 20)
  return b
}

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "b1t-icon-"))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe("windowIconFiles", () => {
  it("prefers the multi-size .ico on Windows, then the PNG", () => {
    expect(icon.windowIconFiles("win32")).toEqual(["favicon.ico", "icon.png"])
  })
  it("uses only the PNG elsewhere, because Electron can't read .ico there", () => {
    expect(icon.windowIconFiles("linux")).toEqual(["icon.png"])
    expect(icon.windowIconFiles("darwin")).toEqual(["icon.png"])
  })
})

describe("faviconFile", () => {
  const has = (...files: string[]) => (f: string) => files.includes(f)
  it("falls back from .ico to PNG to the bundled image", () => {
    expect(icon.faviconFile(has("favicon.ico", "icon.png")).href).toBe("./favicon.ico")
    expect(icon.faviconFile(has("icon.png"))).toEqual({ href: "./icon.png", type: "image/png" })
    expect(icon.faviconFile(has())).toEqual({ href: "./images/LilWhiteGuy(2).svg", type: "image/svg+xml" })
  })
  it("falls back to an image that really exists in the repo", () => {
    expect(fs.existsSync(path.join(__dirname, "..", "..", "public", icon.FALLBACK_SVG))).toBe(true)
  })
})

describe("pngSize", () => {
  it("reads the size from the header", () => {
    expect(icon.pngSize(pngHeader(1024, 512))).toEqual({ width: 1024, height: 512 })
  })
  it("rejects anything else", () => {
    expect(icon.pngSize(Buffer.from("not an image at all, just some text"))).toBeNull()
    expect(icon.pngSize(Buffer.alloc(4))).toBeNull()
  })
})

describe("macIconFile: a bad image must not break the macOS build", () => {
  const warn = vi.fn()
  const write = (b: Buffer) => fs.writeFileSync(path.join(dir, "icon.png"), b)
  beforeEach(() => warn.mockClear())

  it("uses a large enough PNG", () => {
    write(pngHeader(512, 512))
    expect(icon.macIconFile(dir, { warn })).toBe(path.join(dir, "icon.png"))
    expect(warn).not.toHaveBeenCalled()
  })
  it("quietly keeps the default when there's no icon", () => {
    expect(icon.macIconFile(dir, { warn })).toBeNull()
    expect(warn).not.toHaveBeenCalled()
  })
  it("warns and keeps the default for a small image", () => {
    write(pngHeader(256, 256))
    expect(icon.macIconFile(dir, { warn })).toBeNull()
    expect(warn.mock.calls[0][0]).toMatch(/256x256/)
  })
  it("warns and keeps the default for a file that isn't a PNG", () => {
    write(Buffer.from("a jpeg renamed to png, say, with enough bytes to read"))
    expect(icon.macIconFile(dir, { warn })).toBeNull()
    expect(warn.mock.calls[0][0]).toMatch(/isn't a valid PNG/)
  })
})

describe("linuxIconFile", () => {
  it("prefers the PNG, then the bundled image", () => {
    const has = (...names: string[]) => (f: string) => names.some((n) => f.endsWith(n))
    expect(icon.linuxIconFile("/p", has("icon.png", ".svg")).name).toBe("icon.png")
    expect(icon.linuxIconFile("/p", has(".svg")).name).toBe("icon.svg")
    expect(icon.linuxIconFile("/p", has())).toBeNull()
  })
})

describe("windowsShortcutIcon", () => {
  it("only uses an .ico, which is all a shortcut can show", () => {
    expect(icon.windowsShortcutIcon("/p", () => false)).toBeNull()
    expect(icon.windowsShortcutIcon("C:\\p", () => true)).toContain("favicon.ico")
  })
})
