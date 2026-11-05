import { createRequire } from "module"
import { describe, expect, it, vi } from "vitest"

const require = createRequire(import.meta.url)
const { classify, createAccountApi } = require("./accountApi.cjs")

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const video = (id: string, channelTitle = "Artist", categoryId = "10") => ({ id, snippet: { title: `t-${id}`, channelTitle, categoryId, thumbnails: { default: { url: "u" } } }, contentDetails: { duration: "PT2M" }, status: { embeddable: true } })

describe("classify", () => {
  it.each([
    [403, "quotaExceeded", "QUOTA_EXCEEDED"],
    [403, "dailyLimitExceeded", "QUOTA_EXCEEDED"],
    [403, "insufficientPermissions", "NEEDS_RECONNECT"],
    [403, "accessNotConfigured", "API_NOT_ENABLED"],
    [404, "channelNotFound", "NO_CHANNEL"],
    [403, "youtubeSignupRequired", "NO_CHANNEL"],
    [404, "playlistNotFound", "PLAYLIST_UNAVAILABLE"],
    [500, "backendError", "YOUTUBE_API_ERROR"],
  ])("%i %s → %s", (status, reason, code) => {
    expect(classify(status, { error: { errors: [{ reason }] } }).code).toBe(code)
  })
  it("treats a 401 that survived the retry as needing a reconnect", () => {
    expect(classify(401, {}).code).toBe("NEEDS_RECONNECT")
  })
})

describe("channel", () => {
  it("identifies the account", async () => {
    const api = createAccountApi({ authorizedFetch: async () => json({ items: [{ id: "UC1", snippet: { title: "Me", thumbnails: { default: { url: "u" } } } }] }) })
    expect(await api.channel()).toEqual({ id: "UC1", title: "Me", thumbnail: "u" })
  })
  it("explains an account with no channel", async () => {
    await expect(createAccountApi({ authorizedFetch: async () => json({ items: [] }) }).channel()).rejects.toMatchObject({ code: "NO_CHANNEL" })
  })
})

describe("paging", () => {
  it("follows every page", async () => {
    const authorizedFetch = vi.fn(async (url: string) => {
      if (url.includes("pageToken=p2")) return json({ items: [{ id: "PL2", snippet: { title: "B" }, contentDetails: { itemCount: 2 } }] })
      return json({ items: [{ id: "PL1", snippet: { title: "A" }, contentDetails: { itemCount: 1 } }], nextPageToken: "p2" })
    })
    const lists = await createAccountApi({ authorizedFetch }).playlists()
    expect(lists.map((p: { id: string }) => p.id)).toEqual(["PL1", "PL2"])
    expect(authorizedFetch).toHaveBeenCalledTimes(2)
    expect(authorizedFetch.mock.calls[0][0]).toContain("mine=true")
  })
  it("stops at a sensible limit rather than using up the quota", async () => {
    const authorizedFetch = vi.fn(async () => json({ items: Array.from({ length: 50 }, (_, i) => video(`v${i}`)), nextPageToken: "more" }))
    const liked = await createAccountApi({ authorizedFetch }).likedVideos()
    expect(liked.length).toBeLessThanOrEqual(2050)
    expect(authorizedFetch.mock.calls.length).toBeLessThanOrEqual(41)
  })
})

describe("likedVideos", () => {
  it("marks which likes are music, so non-music can start unticked", async () => {
    const authorizedFetch = async (url: string) => {
      expect(url).toContain("myRating=like")
      return json({ items: [video("a", "Band", "10"), video("b", "Vlogger", "22")] })
    }
    const liked = await createAccountApi({ authorizedFetch }).likedVideos()
    expect(liked.map((v: { isMusic: boolean }) => v.isMusic)).toEqual([true, false])
    expect(liked[0]).toMatchObject({ duration: 120, channel: "Band", thumbnail: "u" })
  })
})

describe("subscriptions", () => {
  it("returns channels, skipping malformed entries", async () => {
    const authorizedFetch = async () => json({ items: [{ snippet: { title: "Band - Topic", resourceId: { channelId: "UC9" }, thumbnails: {} } }, { snippet: { title: "broken" } }] })
    expect(await createAccountApi({ authorizedFetch }).subscriptions()).toEqual([{ channelId: "UC9", title: "Band - Topic", thumbnail: null }])
  })
})

describe("playlistItems", () => {
  it("uses each video's own channel, not the playlist owner's", async () => {
    const authorizedFetch = async (url: string) => {
      if (url.includes("/playlistItems?")) return json({ items: [{ snippet: { channelTitle: "Playlist Owner" }, contentDetails: { videoId: "a" } }] })
      return json({ items: [video("a", "Real Artist")] })
    }
    const [v] = await createAccountApi({ authorizedFetch }).playlistItems("PL1")
    expect(v.channel).toBe("Real Artist")
  })
  it("keeps deleted and private videos, marked unavailable, in their position", async () => {
    const authorizedFetch = async (url: string) => {
      if (url.includes("/playlistItems?")) return json({ items: [{ contentDetails: { videoId: "gone" } }, { contentDetails: { videoId: "a" } }] })
      return json({ items: [video("a")] })
    }
    const list = await createAccountApi({ authorizedFetch }).playlistItems("PL1")
    expect(list[0]).toMatchObject({ id: "gone", unavailable: true })
    expect(list[1].id).toBe("a")
  })
  it("batches lookups at the API's limit of 50", async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `v${i}`)
    const lookups: number[] = []
    const authorizedFetch = async (url: string) => {
      if (url.includes("/playlistItems?")) return json({ items: ids.map((videoId) => ({ contentDetails: { videoId } })) })
      const asked = new URL(url).searchParams.get("id")!.split(",")
      lookups.push(asked.length)
      return json({ items: asked.map((id) => video(id)) })
    }
    expect(await createAccountApi({ authorizedFetch }).playlistItems("PL1")).toHaveLength(120)
    expect(lookups).toEqual([50, 50, 20])
  })
})
