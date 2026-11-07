import { createRequire } from "module"
import crypto from "crypto"
import fs from "fs"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const require = createRequire(import.meta.url)
const { assetName, compareVersions, createYtDlpUpdater, findChecksum } = require("./ytdlpUpdate.cjs")

const NEW_BINARY = Buffer.from("new yt-dlp binary")
const sha256 = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex")

function fakeGitHub({ tag = "2026.10.26", asset = assetName(), binary = NEW_BINARY, sums = `${sha256(NEW_BINARY)}  ${assetName()}\n`, offline = false } = {}) {
  return vi.fn(async (url: string) => {
    if (offline) throw new Error("getaddrinfo ENOTFOUND")
    if (url.endsWith("/releases/latest")) return new Response(JSON.stringify({ tag_name: tag }))
    if (url.endsWith("SHA2-256SUMS")) return new Response(sums)
    if (url.endsWith(`/${asset}`)) return new Response(new Uint8Array(binary), { headers: { "content-length": String(binary.length) } })
    return new Response("", { status: 404 })
  })
}

describe("compareVersions", () => {
  it.each([
    ["2026.10.26", "2026.10.25", 1],
    ["2026.10.25", "2026.10.26", -1],
    ["2026.10.26", "2026.10.26", 0],
    ["2026.10.26.1", "2026.10.26", 1],
    ["2026.10.26", "2026.10.26.1", -1],
    ["2026.11.1", "2026.10.26", 1], // numeric, not alphabetical
    ["2027.1.1", "2026.12.31", 1],
  ])("%s vs %s", (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected)
  })
})

describe("assetName", () => {
  it("names the real release file for each platform", () => {
    expect(assetName("win32", "x64")).toBe("yt-dlp.exe")
    expect(assetName("win32", "arm64")).toBe("yt-dlp_arm64.exe")
    expect(assetName("darwin", "arm64")).toBe("yt-dlp_macos")
    expect(assetName("linux", "x64")).toBe("yt-dlp_linux")
    expect(assetName("linux", "arm64")).toBe("yt-dlp_linux_aarch64")
  })
})

describe("findChecksum", () => {
  const hash = "a".repeat(64)
  it("matches the exact file name only", () => {
    const sums = `${"b".repeat(64)}  yt-dlp.exe.zip\n${hash}  yt-dlp.exe\n`
    expect(findChecksum(sums, "yt-dlp.exe")).toBe(hash)
  })
  it("handles binary-mode entries and Windows line endings", () => {
    expect(findChecksum(`${hash} *yt-dlp\r\n`, "yt-dlp")).toBe(hash)
  })
  it("returns null when the file isn't listed", () => {
    expect(findChecksum(`${hash}  other\n`, "yt-dlp")).toBeNull()
  })
})

describe("updater", () => {
  let dir: string
  let target: string
  const privateTool = () => ({ name: "yt-dlp", path: target, source: "private" })

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "b1t-update-"))
    target = path.join(dir, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp")
    fs.writeFileSync(target, "old binary")
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "info").mockImplementation(() => {})
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  function make(overrides: Record<string, unknown> = {}) {
    return createYtDlpUpdater({ resolve: privateTool, toolsDir: dir, fetchFn: fakeGitHub(), versionOf: async (f: string) => (f === target && fs.readFileSync(f, "utf8") === "old binary" ? "2026.1.1" : "2026.10.26"), idlePollMs: 1, ...overrides })
  }

  describe("check", () => {
    it("suggests an update when GitHub has a newer version", async () => {
      expect(await make().check()).toMatchObject({ status: "available", current: "2026.1.1", latest: "2026.10.26", source: "private" })
    })
    it("reports a copy that won't run as a problem, not as an update, and doesn't need GitHub for that", async () => {
      const fetchFn = fakeGitHub()
      const s = await make({ fetchFn, versionOf: async () => { throw new Error("it didn't respond in time") } }).check()
      expect(s).toMatchObject({ status: "error", current: null })
      expect(s.error).toContain("didn't respond in time")
      expect(fetchFn).not.toHaveBeenCalled()
    })
    it("stays quiet when already current", async () => {
      expect(await make({ versionOf: async () => "2026.10.26" }).check()).toMatchObject({ status: "up-to-date" })
    })
    it("never suggests a downgrade", async () => {
      expect(await make({ versionOf: async () => "2026.12.1" }).check()).toMatchObject({ status: "up-to-date" })
    })
    it("is silent when offline", async () => {
      const s = await make({ fetchFn: fakeGitHub({ offline: true }) }).check()
      expect(s.status).toBe("unknown")
      expect(s.error ?? null).toBeNull()
    })
    it("offers an install when yt-dlp is missing", async () => {
      const u = make({ resolve: () => ({ name: "yt-dlp", path: null, source: "missing" }) })
      expect(await u.check()).toMatchObject({ status: "available", current: null })
    })
    it("offers a separate copy instead of touching a system yt-dlp", async () => {
      const u = make({ resolve: () => ({ name: "yt-dlp", path: "/usr/bin/yt-dlp", source: "path" }), versionOf: async () => "2026.1.1" })
      expect(await u.check()).toMatchObject({ status: "available", source: "path" })
    })
    it("leaves a B1T_YTDLP copy alone and doesn't ask GitHub", async () => {
      const fetchFn = fakeGitHub()
      const u = make({ resolve: () => ({ name: "yt-dlp", path: "/opt/yt-dlp", source: "env" }), fetchFn })
      expect(await u.check()).toMatchObject({ status: "unmanaged", current: "2026.10.26" })
      expect(fetchFn).not.toHaveBeenCalled()
    })
    it("rejects a nonsense release tag", async () => {
      expect(await make({ fetchFn: fakeGitHub({ tag: "<html>" }) }).check()).toMatchObject({ status: "unknown" })
    })
  })

  describe("update", () => {
    it("replaces only the private binary, and keeps the old one", async () => {
      const u = make()
      await u.check()
      const onInstalled = vi.fn()
      const final = await make({ onInstalled }).update()
      expect(final).toMatchObject({ status: "up-to-date", current: "2026.10.26", source: "private" })
      expect(fs.readFileSync(target, "utf8")).toBe(NEW_BINARY.toString())
      expect(fs.readFileSync(`${target}.previous`, "utf8")).toBe("old binary")
      expect(onInstalled).toHaveBeenCalledOnce()
      expect(fs.readdirSync(dir).sort()).toEqual([path.basename(target), `${path.basename(target)}.previous`].sort())
    })

    it("discards a corrupt download and keeps the current version", async () => {
      const onInstalled = vi.fn()
      const u = make({ fetchFn: fakeGitHub({ binary: Buffer.from("tampered") }), onInstalled })
      const s = await u.update()
      expect(s.status).toBe("error")
      expect(s.error).toMatch(/checksum/)
      expect(s.error).toMatch(/unchanged/)
      expect(fs.readFileSync(target, "utf8")).toBe("old binary")
      expect(fs.readdirSync(dir)).toEqual([path.basename(target)])
      expect(onInstalled).not.toHaveBeenCalled()
    })

    it("refuses a release with no checksum for this file", async () => {
      const s = await make({ fetchFn: fakeGitHub({ sums: "" }) }).update()
      expect(s.error).toMatch(/no checksum/)
      expect(fs.readFileSync(target, "utf8")).toBe("old binary")
    })

    it("keeps the current version when the new file won't run", async () => {
      const s = await make({ versionOf: async () => { throw new Error("not a valid executable") } }).update()
      expect(s.status).toBe("error")
      expect(fs.readFileSync(target, "utf8")).toBe("old binary")
    })

    it("rejects a binary reporting a different version than the release", async () => {
      const s = await make({ versionOf: async () => "2020.1.1" }).update()
      expect(s.error).toMatch(/2020\.1\.1/)
      expect(fs.readFileSync(target, "utf8")).toBe("old binary")
    })

    it("waits for active downloads before swapping", async () => {
      let busy = 3
      const states: string[] = []
      const u = make({ isBusy: () => busy-- > 0, emit: (s: { status: string }) => states.push(s.status) })
      await u.update()
      expect(states).toContain("waiting")
      expect(states.indexOf("waiting")).toBeLessThan(states.lastIndexOf("up-to-date"))
      expect(fs.readFileSync(target, "utf8")).toBe(NEW_BINARY.toString())
    })

    it("installs a first copy when none exists", async () => {
      fs.rmSync(target)
      const s = await make({ resolve: () => ({ name: "yt-dlp", path: null, source: "missing" }) }).update()
      expect(s).toMatchObject({ status: "up-to-date", source: "private" })
      expect(fs.readFileSync(target, "utf8")).toBe(NEW_BINARY.toString())
    })

    it("refuses to touch a B1T_YTDLP copy", async () => {
      const fetchFn = fakeGitHub()
      const s = await make({ resolve: () => ({ name: "yt-dlp", path: "/opt/yt-dlp", source: "env" }), fetchFn }).update()
      expect(s.status).toBe("unmanaged")
      expect(fetchFn).not.toHaveBeenCalled()
    })

    it("restores the old file if the final rename fails", async () => {
      const rename = fs.promises.rename.bind(fs.promises)
      vi.spyOn(fs.promises, "rename").mockImplementation(async (from, to) => {
        if (String(from).includes("yt-dlp-update-")) throw Object.assign(new Error("locked"), { code: "EPERM" })
        return rename(from, to)
      })
      const s = await make().update()
      expect(s.status).toBe("error")
      expect(fs.readFileSync(target, "utf8")).toBe("old binary")
    })
  })
})
