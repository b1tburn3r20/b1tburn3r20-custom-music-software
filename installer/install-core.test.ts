import { createRequire } from "module"
import fs from "fs"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const require = createRequire(import.meta.url)
const core = require("./install-core.cjs")
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "tools-manifest.json"), "utf-8"))
const read = (name: string) => fs.readFileSync(path.join(__dirname, name), "utf-8")

describe("parseArgs", () => {
  it("reads every option", () => {
    const o = core.parseArgs(["--source", "/s", "--root", "/r", "--yes", "--force", "--no-launch"])
    expect(o).toMatchObject({ source: "/s", root: "/r", yes: true, force: true, launch: false, uninstall: false })
  })
  it("doesn't need a source to uninstall", () => {
    expect(core.parseArgs(["--root", "/r", "--uninstall"]).uninstall).toBe(true)
  })
  it("rejects typos and missing required options", () => {
    expect(() => core.parseArgs(["--root", "/r", "--source", "/s", "--yse"])).toThrow(/Unknown option/)
    expect(() => core.parseArgs(["--source", "/s"])).toThrow(/--root/)
    expect(() => core.parseArgs(["--root", "/r"])).toThrow(/--source/)
  })
})

describe("downgrade protection", () => {
  it("allows a first install, a reinstall and an upgrade", () => {
    expect(() => core.checkDowngrade(null, "0.2.0", false)).not.toThrow()
    expect(() => core.checkDowngrade("0.2.0", "0.2.0", false)).not.toThrow()
    expect(() => core.checkDowngrade("0.2.0", "0.10.0", false)).not.toThrow() // numeric, not alphabetical
  })
  it("refuses a downgrade, because older builds can't read newer data", () => {
    expect(() => core.checkDowngrade("0.3.0", "0.2.9", false)).toThrow(/older/)
  })
  it("allows one when forced", () => {
    expect(() => core.checkDowngrade("0.3.0", "0.2.9", true)).not.toThrow()
  })
})

describe("tools manifest", () => {
  it.each([
    ["win32", "x64"],
    ["win32", "arm64"],
    ["darwin", "arm64"],
    ["darwin", "x64"],
    ["linux", "x64"],
    ["linux", "arm64"],
  ])("has ffmpeg and ffprobe for %s %s", (platform, arch) => {
    for (const name of ["ffmpeg", "ffprobe"]) {
      const asset = core.toolAsset(manifest, name, platform, arch)
      expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/)
      expect(asset.url).toMatch(/^https:\/\/github\.com\//)
    }
  })
  it("uses the x64 ffmpeg on Windows ARM, which runs under emulation", () => {
    expect(core.toolAsset(manifest, "ffmpeg", "win32", "arm64").url).toContain("win32-x64")
  })
  it("refuses a platform it has no pinned build for", () => {
    expect(() => core.toolAsset(manifest, "ffmpeg", "freebsd", "x64")).toThrow(/No ffmpeg/)
  })
})

describe("bootstrap scripts pin the same Node", () => {
  const version = /NODE_VERSION="([\d.]+)"/.exec(read("install.sh"))?.[1]
  it("in both scripts and the manifest", () => {
    expect(version).toBe(manifest.node.version)
    expect(/\$script:NodeVersion = "([\d.]+)"/.exec(read("install.ps1"))?.[1]).toBe(manifest.node.version)
  })
  it("which is a version the project supports", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"))
    const minimum = /^>=(\d+)\./.exec(pkg.engines.node)?.[1]
    expect(Number(manifest.node.version.split(".")[0])).toBeGreaterThanOrEqual(Number(minimum))
  })
  it("with a hash in the manifest for each placeholder", () => {
    const placeholders = [...read("install.sh").matchAll(/__NODE_SHA_([a-z0-9-]+)__/g), ...read("install.ps1").matchAll(/__NODE_SHA_([a-z0-9-]+)__/g)].map((m) => m[1])
    expect(placeholders.length).toBe(6)
    for (const p of placeholders) expect(manifest.node.sha256[p]).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe("the install scripts", () => {
  it("never upgrade the whole system", () => {
    for (const script of [read("install.sh"), read("install.ps1"), read("install-core.cjs")]) {
      const code = script.split("\n").filter((l) => !/^\s*(#|\/\/)/.test(l)).join("\n")
      expect(code).not.toMatch(/-Syu|pacman -Sy\b|apt(-get)? (dist-)?upgrade|dnf upgrade|zypper (up|dup)\b/)
    }
  })
  it("never disable Electron's sandbox", () => {
    for (const script of [read("install.sh"), read("install.ps1")]) expect(script).not.toContain("--no-sandbox")
    const code = read("install-core.cjs").split("\n").filter((l) => !/^\s*(\/\/)/.test(l) && !l.includes("Never falls back")).join("\n")
    expect(code).not.toContain("--no-sandbox")
  })
  it("run nothing until the whole shell script has downloaded", () => {
    const lines = read("install.sh").trimEnd().split("\n")
    expect(lines[lines.length - 1]).toBe('main "$@"')
  })
  it("use LF endings in the shell script", () => {
    expect(fs.readFileSync(path.join(__dirname, "..", ".gitattributes"), "utf-8")).toMatch(/\*\.sh text eol=lf/)
  })
})

describe("paths", () => {
  it("installs per-user on Windows", () => {
    const p = core.paths("C:\\Users\\A B\\AppData\\Local\\b1tburn3r20", { platform: "win32", home: "C:\\Users\\A B", env: { APPDATA: "C:\\Users\\A B\\AppData\\Roaming" } })
    expect(p.exe).toBe("C:\\Users\\A B\\AppData\\Local\\b1tburn3r20\\app\\b1tburn3r20.exe")
    expect(p.shortcut).toMatch(/Start Menu\\Programs\\b1tburn3r20\.lnk$/)
    expect(p.userData).toBe("C:\\Users\\A B\\AppData\\Roaming\\b1tburn3r20")
  })
  it("puts the macOS app in ~/Applications", () => {
    const p = core.paths("/r", { platform: "darwin", home: "/Users/a", env: {} })
    expect(p.exe).toBe("/Users/a/Applications/b1tburn3r20.app/Contents/MacOS/b1tburn3r20")
    expect(p.userData).toBe("/Users/a/Library/Application Support/b1tburn3r20")
  })
  it("uses XDG locations on Linux", () => {
    const p = core.paths("/r", { platform: "linux", home: "/home/a", env: { XDG_DATA_HOME: "/d", XDG_CONFIG_HOME: "/c" } })
    expect(p.desktopFile).toBe("/d/applications/b1tburn3r20.desktop")
    expect(p.userData).toBe("/c/b1tburn3r20")
    expect(p.binLink).toBe("/home/a/.local/bin/b1tburn3r20")
  })
  it("keeps the app's data out of what an upgrade replaces", () => {
    const p = core.paths("/home/a/.local/share/b1tburn3r20", { platform: "linux", home: "/home/a", env: {} })
    expect(p.userData.startsWith(p.root)).toBe(false)
  })
})

describe("desktopEntry", () => {
  it("quotes a path with spaces", () => {
    expect(core.desktopEntry("/home/a b/app", "icon")).toContain('Exec="/home/a b/app"')
  })
  it("leaves out the icon line when there's no icon", () => {
    expect(core.desktopEntry("/a", "/r/icon.png")).toContain("Icon=/r/icon.png")
    expect(core.desktopEntry("/a", "")).not.toContain("Icon=")
  })
})

describe("swapIntoPlace", () => {
  let dir: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "b1t-swap-"))
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })
  const folder = (name: string, content: string) => {
    fs.mkdirSync(path.join(dir, name))
    fs.writeFileSync(path.join(dir, name, "file"), content)
    return path.join(dir, name)
  }
  const contents = (p: string) => fs.readFileSync(path.join(p, "file"), "utf-8")

  it("installs fresh", () => {
    const target = path.join(dir, "nested", "app")
    core.swapIntoPlace(folder("built", "new"), target)
    expect(contents(target)).toBe("new")
  })
  it("replaces the old install and leaves nothing behind", () => {
    const target = folder("app", "old")
    core.swapIntoPlace(folder("built", "new"), target)
    expect(contents(target)).toBe("new")
    expect(fs.readdirSync(dir)).toEqual(["app"])
  })
  it("restores the old install if the new one can't be moved in", () => {
    const target = folder("app", "old")
    const built = folder("built", "new")
    const rename = fs.renameSync
    vi.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (String(from) === built) throw Object.assign(new Error("locked"), { code: "EPERM" })
      return rename(from, to)
    })
    expect(() => core.swapIntoPlace(built, target)).toThrow("locked")
    expect(contents(target)).toBe("old")
  })
  it("copies across drives, where renaming isn't possible", () => {
    const target = path.join(dir, "app")
    const built = folder("built", "new")
    vi.spyOn(fs, "renameSync").mockImplementation(() => {
      throw Object.assign(new Error("cross-device"), { code: "EXDEV" })
    })
    core.swapIntoPlace(built, target)
    expect(contents(target)).toBe("new")
  })
})
