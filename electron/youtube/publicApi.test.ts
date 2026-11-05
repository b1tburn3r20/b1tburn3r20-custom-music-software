import { createRequire } from "module"
import { describe, expect, it, vi } from "vitest"

const require = createRequire(import.meta.url)
const { classifyApiError, createPublicApi, parseISODuration } = require("./publicApi.cjs")

const KEY = "fake-key-for-unit-tests-only"
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const apiVideo = (id: string) => ({ id, snippet: { title: `t-${id}`, channelTitle: "c", thumbnails: { high: { url: "u" } } }, contentDetails: { duration: "PT1M" }, status: { embeddable: true } })

describe("parseISODuration", () => {
  it("handles hours, minutes, seconds and days", () => {
    expect(parseISODuration("PT4M12S")).toBe(252)
    expect(parseISODuration("PT1H2M3S")).toBe(3723)
    expect(parseISODuration("PT2H")).toBe(7200)
    expect(parseISODuration("P1DT1S")).toBe(86401)
    expect(parseISODuration("PT45S")).toBe(45)
    expect(parseISODuration("")).toBe(0)
    expect(parseISODuration(null)).toBe(0)
  })
})

describe("classifyApiError", () => {
  it("recognises the response Google really sends for a bad key", () => {
    // Captured from the live API with a deliberately invalid key.
    const body = { error: { code: 400, message: "API key not valid. Please pass a valid API key.", errors: [{ reason: "badRequest" }], status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID", domain: "googleapis.com" }] } }
    expect(classifyApiError(400, body).code).toBe("API_KEY_INVALID")
  })
  it.each([
    [{ errors: [{ reason: "quotaExceeded" }] }, "QUOTA_EXCEEDED"],
    [{ errors: [{ reason: "dailyLimitExceeded" }] }, "QUOTA_EXCEEDED"],
    [{ errors: [{ reason: "accessNotConfigured" }] }, "API_NOT_ENABLED"],
    [{ details: [{ reason: "SERVICE_DISABLED" }] }, "API_NOT_ENABLED"],
    [{ details: [{ reason: "API_KEY_SERVICE_BLOCKED" }] }, "API_KEY_RESTRICTED"],
    [{ errors: [{ reason: "ipRefererBlocked" }] }, "API_KEY_RESTRICTED"],
    [{ message: "Something else" }, "YOUTUBE_API_ERROR"],
  ])("%j → %s", (error, code) => {
    expect(classifyApiError(403, { error }).code).toBe(code)
  })
})

describe("createPublicApi", () => {
  it("refuses to call Google without a key", async () => {
    const fetchFn = vi.fn()
    const api = createPublicApi({ getKey: async () => null, fetchFn })
    await expect(api.searchVideos("x")).rejects.toMatchObject({ code: "API_KEY_MISSING" })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it("sends the key in a header and never in the URL", async () => {
    const fetchFn = vi.fn(async () => json({ items: [] }))
    await createPublicApi({ getKey: async () => KEY, fetchFn }).searchVideos("x")
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, { headers: Record<string, string> }]
    expect(url).not.toContain(KEY)
    expect(init.headers["X-Goog-Api-Key"]).toBe(KEY)
  })

  it("doesn't put the key in any error it throws", async () => {
    const api = createPublicApi({ getKey: async () => KEY, fetchFn: async () => json({ error: { message: "nope" } }, 500) })
    const err = await api.searchVideos("x").catch((e: Error) => e)
    expect(`${(err as Error).message} ${JSON.stringify(err)}`).not.toContain(KEY)
  })

  it("keeps search order, and applies the filters", async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes("/search?")) return json({ items: [{ id: { videoId: "bbb" } }, { id: { videoId: "aaa" } }] })
      return json({ items: [apiVideo("aaa"), apiVideo("bbb")] })
    })
    const videos = await createPublicApi({ getKey: async () => KEY, fetchFn }).searchVideos("q", { musicOnly: true, safeSearch: true })
    expect(videos.map((v: { id: string }) => v.id)).toEqual(["bbb", "aaa"])
    const searchUrl = fetchFn.mock.calls[0][0]
    expect(searchUrl).toContain("videoCategoryId=10")
    expect(searchUrl).toContain("safeSearch=strict")
    expect(videos[0]).toMatchObject({ duration: 60, thumbnail: "u", embeddable: true })
  })

  it("marks videos missing from the details as unavailable", async () => {
    const fetchFn = async (url: string) => {
      if (url.includes("/playlists?")) return json({ items: [{ id: "PL1", snippet: { title: "P", channelTitle: "C" }, contentDetails: { itemCount: 2 } }] })
      if (url.includes("/playlistItems?")) return json({ items: [{ contentDetails: { videoId: "aaa" } }, { contentDetails: { videoId: "gone" } }] })
      return json({ items: [apiVideo("aaa")] })
    }
    const p = await createPublicApi({ getKey: async () => KEY, fetchFn }).playlistWithVideos("PL1")
    expect(p.videos[1]).toMatchObject({ id: "gone", unavailable: true })
  })

  it("reports an unreachable network plainly", async () => {
    const api = createPublicApi({ getKey: async () => KEY, fetchFn: async () => { throw new Error("getaddrinfo") } })
    await expect(api.searchVideos("x")).rejects.toMatchObject({ code: "NETWORK" })
  })

  describe("validateKey", () => {
    it("tests the candidate, not whatever is stored", async () => {
      const fetchFn = vi.fn(async () => json({ items: [] }))
      const api = createPublicApi({ getKey: async () => "stored-key", fetchFn })
      await expect(api.validateKey(`  ${KEY}\n`)).resolves.toBe(KEY)
      expect((fetchFn.mock.calls[0] as unknown as [string, { headers: Record<string, string> }])[1].headers["X-Goog-Api-Key"]).toBe(KEY)
    })
    it("rejects obvious junk without a network call", async () => {
      const fetchFn = vi.fn()
      const api = createPublicApi({ getKey: async () => null, fetchFn })
      await expect(api.validateKey("has spaces in it")).rejects.toMatchObject({ code: "API_KEY_INVALID" })
      await expect(api.validateKey("")).rejects.toMatchObject({ code: "API_KEY_INVALID" })
      expect(fetchFn).not.toHaveBeenCalled()
    })
    it("passes on what Google says about a bad key", async () => {
      const api = createPublicApi({ getKey: async () => null, fetchFn: async () => json({ error: { details: [{ reason: "API_KEY_INVALID" }] } }, 400) })
      await expect(api.validateKey(KEY)).rejects.toMatchObject({ code: "API_KEY_INVALID" })
    })
  })
})
