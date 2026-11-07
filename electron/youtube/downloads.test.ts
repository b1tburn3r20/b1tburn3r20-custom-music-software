import { createRequire } from "module"
import fs from "fs"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const { createDownloadManager } = require("./downloads.cjs")
const { createDownloadLog, firstAttempt, nextAttempt } = require("./downloadRetry.cjs")
const { YtError } = require("./ytdlp.cjs")

const fail = (code: string, detail = "") => new YtError(code, `failed: ${code}`, detail)

describe("nextAttempt", () => {
  it("starts signed in only when sign-in is set up", () => {
    expect(firstAttempt("file").mode).toBe("signed")
    expect(firstAttempt("none").mode).toBe("android")
  })
  it("works down from sign-in to the plain client, then gives up", () => {
    const a = nextAttempt(firstAttempt("file"), fail("AUTH_EXPIRED"))
    expect(a.mode).toBe("android")
    const b = nextAttempt(a, fail("DOWNLOAD_FAILED"))
    expect(b.mode).toBe("plain")
    expect(nextAttempt(b, fail("DOWNLOAD_FAILED"))).toBeNull()
  })
  it("drops the cover art when converting it is what failed, keeping the same way of asking", () => {
    expect(nextAttempt(firstAttempt("file"), fail("DOWNLOAD_FAILED", "Postprocessing: Conversion failed!"))).toEqual({ mode: "signed", noThumbnail: true })
  })
  it.each(["CANCELLED", "FOLDER_NOT_WRITABLE", "RATE_LIMITED", "VIDEO_UNAVAILABLE", "PRIVATE_VIDEO", "YTDLP_MISSING"])("doesn't retry %s", (code) => {
    expect(nextAttempt(firstAttempt("file"), fail(code))).toBeNull()
  })
})

describe("the download queue", () => {
  let dir: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "b1t-downloads-"))
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  /** A manager whose yt-dlp fails as told, and "downloads" otherwise. */
  function setup(outcomes: Record<string, (args: string[]) => Error | null>, saveQueue: (list: never[]) => void = () => {}) {
    const calls: { video: string; args: string[] }[] = []
    const updates: { videoId: string; status: string; note: string | null; error: { code: string } | null }[] = []
    const run = async (args: string[], { onLine }: { onLine: (line: string, stream: string) => void }) => {
      const video = args[args.length - 1].split("=").pop() as string
      calls.push({ video, args })
      const err = outcomes[video]?.(args)
      if (err) throw err
      const file = args[args.indexOf("-o") + 1].replace(".%(ext)s", ".mp3")
      fs.writeFileSync(file, "mp3")
      onLine(file, "stdout")
      return { stdout: "" }
    }
    const songs: { id: string }[] = []
    const manager = createDownloadManager({
      library: { rootDir: dir, visibleSongs: () => [], clearedOwner: () => null, addFile: async () => { const s = { id: `s${songs.length}` }; songs.push(s); return s } },
      user: { addRecentlyDownloaded: () => {} },
      youtube: { authMode: () => "file", authArgs: () => ["--cookies", "c.txt"] },
      emit: (i: (typeof updates)[number]) => updates.push(i),
      run,
      diagnose: async () => null,
      log: createDownloadLog(path.join(dir, "logs", "downloads.log")),
      saveQueue,
    })
    return { manager, calls, updates, songs }
  }

  it("saves a song that YouTube refuses signed in, by asking without sign-in", async () => {
    const { manager, calls, songs } = setup({ aaaaaaaaaaa: (args) => (args.includes("--cookies") ? fail("DOWNLOAD_FAILED", "HTTP Error 403: Forbidden") : null) })
    manager.enqueue([{ videoId: "aaaaaaaaaaa", title: "Song" }])
    const item = await manager.waitFor("aaaaaaaaaaa")
    expect(item.status).toBe("done")
    expect(item.note).toContain("without sign-in")
    expect(songs).toHaveLength(1)
    expect(calls.map((c) => c.args.includes("--cookies"))).toEqual([true, false])
    await new Promise((r) => setTimeout(r, 20))
    expect(fs.readFileSync(path.join(dir, "logs", "downloads.log"), "utf-8")).toContain("HTTP Error 403")
  })

  it("reports the first error when every way fails, and logs each one", async () => {
    const { manager, calls } = setup({ bbbbbbbbbbb: () => fail("DOWNLOAD_FAILED", "nope") })
    manager.enqueue([{ videoId: "bbbbbbbbbbb", title: "Song" }])
    const item = await manager.waitFor("bbbbbbbbbbb")
    expect(item.status).toBe("error")
    expect(calls).toHaveLength(3)
    await new Promise((r) => setTimeout(r, 20))
    expect(fs.readFileSync(path.join(dir, "logs", "downloads.log"), "utf-8").match(/failed bbbbbbbbbbb/g)).toHaveLength(3)
  })

  it("doesn't keep asking once YouTube is rate limiting", async () => {
    const { manager, calls } = setup({ ccccccccccc: () => fail("RATE_LIMITED") })
    manager.enqueue([{ videoId: "ccccccccccc", title: "Song" }])
    await manager.waitFor("ccccccccccc")
    expect(calls).toHaveLength(1)
  })

  it("remembers what's still to do, and picks it up after a restart", async () => {
    const saved: { video: { videoId: string; title: string }; target: unknown }[][] = []
    const first = setup({ eeeeeeeeeee: () => null }, (list) => saved.push(list))
    const target = { id: "pl1", mirror: true }
    first.manager.enqueue([{ videoId: "eeeeeeeeeee", title: "One" }, { videoId: "fffffffffff", title: "Two" }, { videoId: "ggggggggggg", title: "Three" }], { target })
    // What a crash or closing the app right after queueing would leave behind.
    const atClose = saved[0]
    expect(atClose.map((e) => e.video.videoId)).toEqual(["eeeeeeeeeee", "fffffffffff", "ggggggggggg"])
    expect(atClose[0].target).toEqual(target)
    await first.manager.waitFor("ggggggggggg")
    await new Promise((r) => setTimeout(r, 20))
    expect(saved[saved.length - 1]).toEqual([])

    const second = setup({})
    expect(second.manager.resume(JSON.parse(JSON.stringify(atClose)))).toBe(3)
    expect((await second.manager.waitFor("ggggggggggg")).status).toBe("done")
    expect(second.songs).toHaveLength(3)
  })

  it("ignores a damaged saved queue", () => {
    const { manager } = setup({})
    expect(manager.resume(null)).toBe(0)
    expect(manager.resume([null, { nothing: true }])).toBe(0)
  })

  it("retries what failed, back into the same playlist", async () => {
    let broken = true
    const { manager } = setup({ ddddddddddd: () => (broken ? fail("RATE_LIMITED") : null) })
    manager.enqueue([{ videoId: "ddddddddddd", title: "Song" }])
    await manager.waitFor("ddddddddddd")
    broken = false
    expect(manager.retryFailed()).toBe(1)
    expect((await manager.waitFor("ddddddddddd")).status).toBe("done")
  })
})
