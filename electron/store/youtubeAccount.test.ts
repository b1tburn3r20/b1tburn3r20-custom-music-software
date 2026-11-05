import { createRequire } from "module"
import fs from "fs"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const { createYoutubeAccountStore, MAX_AGE_MS, REFRESH_AFTER_MS } = require("./youtubeAccount.cjs")

let dir: string
let time: number
const make = () => createYoutubeAccountStore({ userData: dir, now: () => time })
const fileOf = () => path.join(dir, "youtube-account.json")

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "b1t-account-"))
  time = 1_000_000_000_000
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe("YouTube account snapshot", () => {
  it("starts empty", async () => {
    const s = make()
    await s.load()
    expect(s.get()).toMatchObject({ fetchedAt: null, playlists: [], liked: [], subscriptions: [] })
    expect(s.isStale()).toBe(true)
  })

  it("survives a restart", async () => {
    const s = make()
    await s.load()
    await s.update({ playlists: [{ id: "PL1" }] })
    const again = make()
    await again.load()
    expect(again.get().playlists).toEqual([{ id: "PL1" }])
  })

  it("asks for a refresh after a day", async () => {
    const s = make()
    await s.load()
    await s.update({ playlists: [] })
    expect(s.isStale()).toBe(false)
    time += REFRESH_AFTER_MS + 1
    expect(s.isStale()).toBe(true)
  })

  describe("the 30-day limit", () => {
    async function snapshotAged(ms: number) {
      const s = make()
      await s.load()
      await s.update({ playlists: [{ id: "PL1" }], liked: [{ id: "v" }], subscriptions: [{ channelId: "c" }], channel: { title: "Me" } })
      await s.takeUnappliedLikes(["v"])
      await s.dismiss("x")
      time += ms
      const later = make()
      const report = await later.load()
      return { later, report }
    }

    it("keeps data at exactly 30 days", async () => {
      const { later, report } = await snapshotAged(MAX_AGE_MS)
      expect(report.purged).toBe(false)
      expect(later.get().playlists).toHaveLength(1)
    })

    it("purges YouTube's data past 30 days, before anything can read it, and from disk too", async () => {
      const { later, report } = await snapshotAged(MAX_AGE_MS + 1)
      expect(report.purged).toBe(true)
      expect(later.get()).toMatchObject({ playlists: [], liked: [], subscriptions: [], channel: null, fetchedAt: null })
      const onDisk = fs.readFileSync(fileOf(), "utf-8")
      expect(onDisk).not.toContain("PL1")
      expect(onDisk).not.toContain("Me")
    })

    it("keeps the user's own choices, so an unliked song stays unliked", async () => {
      const { later } = await snapshotAged(MAX_AGE_MS + 1)
      expect(later.get().appliedLikes).toEqual(["v"])
      expect(later.get().dismissed).toEqual(["x"])
    })
  })

  it("clear removes everything from disk", async () => {
    const s = make()
    await s.load()
    await s.update({ playlists: [{ id: "PL1" }] })
    await s.clear()
    expect(fs.existsSync(fileOf())).toBe(false)
    expect(s.get().playlists).toEqual([])
  })

  it("starts over from a corrupt file rather than failing", async () => {
    fs.writeFileSync(fileOf(), "{ not json")
    const s = make()
    await s.load()
    expect(s.get().playlists).toEqual([])
  })

  describe("takeUnappliedLikes", () => {
    it("returns each like only once, including across restarts", async () => {
      const s = make()
      await s.load()
      expect(await s.takeUnappliedLikes(["a", "b"])).toEqual(["a", "b"])
      expect(await s.takeUnappliedLikes(["a", "b", "c"])).toEqual(["c"])
      const again = make()
      await again.load()
      expect(await again.takeUnappliedLikes(["a", "b", "c", "d"])).toEqual(["d"])
    })
  })

  it("remembers dismissed suggestions, once each", async () => {
    const s = make()
    await s.load()
    await s.dismiss("v1")
    await s.dismiss("v1")
    expect(s.get().dismissed).toEqual(["v1"])
  })
})
