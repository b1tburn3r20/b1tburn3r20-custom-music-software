import { createRequire } from "module"
import { describe, expect, it, vi } from "vitest"

const require = createRequire(import.meta.url)
const t = require("./tools.cjs")

const win = (files: string[], env: Record<string, string> = {}) => ({
  platform: "win32",
  home: "C:\\Users\\me",
  env: { LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local", ...env },
  exists: (p: string) => files.includes(p),
})
const linux = (files: string[], env: Record<string, string> = {}) => ({
  platform: "linux",
  home: "/home/me",
  env,
  exists: (p: string) => files.includes(p),
})
const mac = (files: string[], env: Record<string, string> = {}) => ({ platform: "darwin", home: "/Users/me", env, exists: (p: string) => files.includes(p) })

describe("installRoot", () => {
  it("uses each OS's per-user location, needing no admin rights", () => {
    expect(t.toolsDir(win([]))).toBe("C:\\Users\\me\\AppData\\Local\\b1tburn3r20\\tools")
    expect(t.toolsDir(linux([]))).toBe("/home/me/.local/share/b1tburn3r20/tools")
    expect(t.toolsDir(mac([]))).toBe("/Users/me/Library/Application Support/b1tburn3r20-install/tools")
  })
  it("honours XDG_DATA_HOME and an explicit override", () => {
    expect(t.toolsDir(linux([], { XDG_DATA_HOME: "/data" }))).toBe("/data/b1tburn3r20/tools")
    expect(t.installRoot(linux([], { B1T_INSTALL_ROOT: "/custom" }))).toBe("/custom")
  })
})

describe("resolveTool", () => {
  const privateYt = "/home/me/.local/share/b1tburn3r20/tools/yt-dlp"

  it("prefers the private copy over one from a package manager", () => {
    const r = t.resolveTool("yt-dlp", linux([privateYt, "/usr/bin/yt-dlp"], { PATH: "/usr/bin" }))
    expect(r).toEqual({ name: "yt-dlp", path: privateYt, source: "private" })
  })
  it("falls back to the system copy", () => {
    expect(t.resolveTool("yt-dlp", linux(["/usr/bin/yt-dlp"], { PATH: "/usr/bin" })).source).toBe("path")
  })
  it("lets B1T_YTDLP override everything, for yt-dlp only", () => {
    const env = { B1T_YTDLP: "/opt/yt-dlp", PATH: "/usr/bin" }
    expect(t.resolveTool("yt-dlp", linux([privateYt], env))).toEqual({ name: "yt-dlp", path: "/opt/yt-dlp", source: "env" })
    expect(t.resolveTool("ffmpeg", linux([], env)).source).toBe("missing")
  })
  it("reports a missing tool instead of guessing", () => {
    expect(t.resolveTool("yt-dlp", linux([], { PATH: "/nowhere" }))).toEqual({ name: "yt-dlp", path: null, source: "missing" })
  })
  it("finds Homebrew's copy on macOS even without a shell PATH", () => {
    expect(t.resolveTool("yt-dlp", mac(["/opt/homebrew/bin/yt-dlp"])).path).toBe("/opt/homebrew/bin/yt-dlp")
  })
  it("adds .exe on Windows and honours PATHEXT", () => {
    const privateExe = "C:\\Users\\me\\AppData\\Local\\b1tburn3r20\\tools\\yt-dlp.exe"
    expect(t.resolveTool("yt-dlp", win([privateExe])).path).toBe(privateExe)
    const onPath = win(["C:\\bin\\adb.EXE"], { PATH: "C:\\bin", PATHEXT: ".COM;.EXE" })
    expect(t.resolveTool("adb", onPath).path).toBe("C:\\bin\\adb.EXE")
  })
})

describe("ytDlpBaseArgs", () => {
  const dir = "/home/me/.local/share/b1tburn3r20/tools"

  it("always ignores stray config and forces UTF-8 output", () => {
    const args = t.ytDlpBaseArgs(linux([]))
    expect(args).toContain("--ignore-config")
    expect(args.join(" ")).toContain("--encoding utf-8")
  })
  it("points yt-dlp at private Node and ffmpeg", () => {
    const args = t.ytDlpBaseArgs(linux([`${dir}/node`, `${dir}/ffmpeg`])).join(" ")
    expect(args).toContain(`--js-runtimes node:${dir}/node`)
    expect(args).toContain(`--ffmpeg-location ${dir}`)
  })
  it("leaves a system ffmpeg for yt-dlp to find by itself", () => {
    expect(t.ytDlpBaseArgs(linux(["/usr/bin/ffmpeg"], { PATH: "/usr/bin" }))).not.toContain("--ffmpeg-location")
  })
  it("keeps a Windows path intact after the runtime name", () => {
    const node = "C:\\Users\\me\\AppData\\Local\\b1tburn3r20\\tools\\node.exe"
    expect(t.ytDlpBaseArgs(win([node]))).toContain(`node:${node}`)
  })
})

describe("killProcessTree", () => {
  it("uses taskkill /T on Windows, so yt-dlp's ffmpeg child stops too", () => {
    const on = vi.fn()
    const spawnFn = vi.fn(() => ({ on }))
    t.killProcessTree({ pid: 42, kill: vi.fn() }, { platform: "win32", spawnFn })
    expect(spawnFn).toHaveBeenCalledWith("taskkill", ["/pid", "42", "/T", "/F"], expect.objectContaining({ windowsHide: true }))
  })
  it("ignores a process that never started", () => {
    const spawnFn = vi.fn()
    t.killProcessTree({ pid: undefined }, { platform: "win32", spawnFn })
    expect(spawnFn).not.toHaveBeenCalled()
  })
})
