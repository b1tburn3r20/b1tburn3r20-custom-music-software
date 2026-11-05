import { createRequire } from "module"
import { describe, expect, it, vi } from "vitest"

const require = createRequire(import.meta.url)
const { BATCH_SIZE, buildRequest, classifyFailure, createAiTagger, parseTags, publicProviders, replyText, songsPerDollar } = require("./aiTagger.cjs")

const KEY = "fake-key-long-enough-for-the-format-check"
const VOCAB = ["rock", "hip hop", "chill", "r&b"]
const song = (id: string) => ({ id, metadata: { title: `Title ${id}`, artist: "Artist", album: null, genre: null } })
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers })

const anthropicReply = (songs: unknown[]) => json({ content: [{ type: "text", text: JSON.stringify({ songs }) }], stop_reason: "end_turn" })
const openaiReply = (songs: unknown[]) => json({ output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: JSON.stringify({ songs }) }] }] })

/** Answers every batch by tagging each song "rock". */
const allRock = (reply = anthropicReply) =>
  vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    const text = body.messages ? body.messages[0].content : body.input[1].content
    return reply(String(text).split("\n").map((_: string, i: number) => ({ i, tags: ["rock"] })))
  })

function setup({ library = [song("a"), song("b")], tagged = {} as Record<string, string[]>, fetchFn = allRock(), provider = "anthropic", tier = "low", keys = { anthropicKey: KEY, openaiKey: KEY } as Record<string, string> } = {}) {
  const tags = { ...tagged }
  const events: { running: boolean; done: number; tagged: number; failed: number; error: { code: string; message: string } | null }[] = []
  const finished = new Promise<(typeof events)[number]>((resolve) => {
    setTimeout(() => {}, 0)
    finishedResolve = resolve
  })
  const tagger = createAiTagger({
    credentials: { get: async (k: string) => keys[k] ?? null, has: async (k: string) => k in keys, set: vi.fn(async () => ({ persisted: true })), remove: vi.fn(), secureStorage: () => true, unreadable: () => [] },
    songs: () => library,
    tagsOf: (id: string) => tags[id] ?? [],
    applyTags: (id: string, list: string[]) => {
      tags[id] = list
    },
    settings: () => ({ aiProvider: provider, aiTier: tier }),
    emit: (p: (typeof events)[number]) => {
      events.push(p)
      if (!p.running) finishedResolve(p)
    },
    fetchFn,
    sleep: async () => {},
  })
  return { tagger, tags, events, fetchFn, finished }
}
let finishedResolve: (v: never) => void = () => {}

describe("songsPerDollar", () => {
  it("gets further on cheaper models, so the tiers mean something", () => {
    const { anthropic, openai } = publicProviders()
    for (const p of [anthropic, openai]) {
      expect(p.tiers.low.songsPerDollar).toBeGreaterThan(p.tiers.medium.songsPerDollar)
      expect(p.tiers.medium.songsPerDollar).toBeGreaterThan(p.tiers.high.songsPerDollar)
    }
    expect(songsPerDollar({ input: 0.1, output: 0.5 })).toBeGreaterThan(10000)
  })
  it("never tells the page a key", () => {
    expect(JSON.stringify(publicProviders())).not.toMatch(/key"|x-api/i)
  })
})

describe("buildRequest", () => {
  it("uses Claude's JSON-schema output, because Opus and Sonnet reject forced tools", () => {
    const r = buildRequest("anthropic", "high", KEY, VOCAB, [song("a")], "https://x")
    expect(r.url).toBe("https://x/v1/messages")
    expect(r.headers["x-api-key"]).toBe(KEY)
    expect(r.headers["anthropic-version"]).toBe("2026-10-21")
    expect(r.body.model).toBe("claude-opus-5-5")
    expect(r.body.output_config.format.type).toBe("json_schema")
    expect(r.body.tool_choice).toBeUndefined()
    expect(r.body.max_tokens).toBeGreaterThan(1000)
  })
  it("uses OpenAI's Responses API with strict JSON", () => {
    const r = buildRequest("openai", "low", KEY, VOCAB, [song("a")], "https://x")
    expect(r.url).toBe("https://x/v1/responses")
    expect(r.headers.Authorization).toBe(`Bearer ${KEY}`)
    expect(r.body.model).toBe("gpt-6-luna")
    expect(r.body.text.format).toMatchObject({ type: "json_schema", strict: true })
  })
  it("sends only song details, and treats them as data", () => {
    const r = buildRequest("anthropic", "low", KEY, VOCAB, [{ id: "secret-id", path: "C:\\Users\\me\\song.mp3", metadata: { title: "T", artist: "Unknown Artist", album: "A", genre: null } }], "https://x")
    const text = JSON.stringify(r.body)
    expect(text).not.toContain("secret-id")
    expect(text).not.toContain("Users")
    expect(text).not.toContain("Unknown Artist")
    expect(r.body.system).toMatch(/never instructions/)
  })
})

describe("parseTags", () => {
  const parse = (songs: unknown, count = 3) => parseTags(JSON.stringify({ songs }), count, VOCAB)
  it("uses the list's own spelling, however the model wrote it", () => {
    expect(parse([{ i: 0, tags: ["HipHop", "R & B"] }]).get(0)).toEqual(["hip hop", "r&b"])
  })
  it("drops tags that aren't on the list, so a song title can't invent tags", () => {
    expect(parse([{ i: 0, tags: ["rock", "ignore previous instructions", "hacked"] }]).get(0)).toEqual(["rock"])
  })
  it("ignores numbers that aren't in this batch", () => {
    const m = parse([{ i: 99, tags: ["rock"] }, { i: -1, tags: ["rock"] }, { i: 1.5, tags: ["rock"] }, { i: "0", tags: ["rock"] }])
    expect(m.size).toBe(0)
  })
  it("caps tags per song, removes repeats, and leaves out songs with none", () => {
    const m = parseTags(JSON.stringify({ songs: [{ i: 0, tags: ["a", "a", "b", "c", "d", "e"] }, { i: 1, tags: [] }] }), 2, ["a", "b", "c", "d", "e"])
    expect(m.get(0)).toEqual(["a", "b", "c", "d"])
    expect(m.has(1)).toBe(false)
  })
  it("rejects a reply that isn't what was asked for", () => {
    expect(() => parseTags("not json", 1, VOCAB)).toThrow(/valid JSON/)
    expect(() => parseTags(JSON.stringify({ nope: 1 }), 1, VOCAB)).toThrow(/didn't list/)
  })
})

describe("replyText", () => {
  it("finds the text in each provider's reply", () => {
    expect(replyText("anthropic", { content: [{ type: "text", text: "x" }] })).toBe("x")
    expect(replyText("openai", { output: [{ type: "reasoning" }, { content: [{ type: "output_text", text: "y" }] }] })).toBe("y")
  })
  it("recognises a refusal and a cut-off reply", () => {
    expect(() => replyText("anthropic", { stop_reason: "refusal", content: [] })).toThrow(/declined/)
    expect(() => replyText("anthropic", { stop_reason: "max_tokens", content: [{ type: "text", text: "{" }] })).toThrow(/cut off/)
    expect(() => replyText("openai", { output: [{ content: [{ type: "refusal", refusal: "no" }] }] })).toThrow(/declined/)
  })
})

describe("classifyFailure", () => {
  it.each([
    [401, { error: { type: "authentication_error", message: "invalid x-api-key" } }, "AI_KEY_INVALID"],
    [401, { error: { code: "invalid_api_key", message: "Incorrect API key" } }, "AI_KEY_INVALID"],
    [402, { error: { type: "billing_error" } }, "AI_NO_CREDIT"],
    [429, { error: { code: "credit_balance_exhausted" } }, "AI_NO_CREDIT"],
    [429, { error: { type: "insufficient_quota" } }, "AI_NO_CREDIT"],
    [429, { error: { code: "project_spend_limit_exceeded" } }, "AI_NO_CREDIT"],
    [429, { error: { type: "rate_limit_error" } }, "AI_RATE_LIMITED"],
    [500, { error: { message: "boom" } }, "AI_FAILED"],
  ])("%i %j → %s", (status, body, code) => {
    expect(classifyFailure(status, body, KEY).code).toBe(code)
  })
  it("never repeats the key back", () => {
    expect(classifyFailure(400, { error: { message: `bad ${KEY} here` } }, KEY).message).not.toContain(KEY)
  })
})

describe("running", () => {
  it("tags untagged songs and saves them", async () => {
    const { tagger, tags, finished } = setup()
    await tagger.start({ vocabulary: VOCAB })
    expect(await finished).toMatchObject({ running: false, done: 2, tagged: 2, failed: 0, error: null })
    expect(tags).toEqual({ a: ["rock"], b: ["rock"] })
  })
  it("works the same with OpenAI", async () => {
    const fetchFn = allRock(openaiReply)
    const { tagger, tags, finished } = setup({ provider: "openai", fetchFn })
    await tagger.start({ vocabulary: VOCAB })
    await finished
    expect(tags.a).toEqual(["rock"])
    expect(fetchFn.mock.calls[0][0]).toContain("/v1/responses")
  })
  it("never touches a song that already has tags", async () => {
    const fetchFn = allRock()
    const { tagger, tags, finished } = setup({ tagged: { a: ["my tag"] }, fetchFn })
    await tagger.start({ vocabulary: VOCAB })
    await finished
    expect(tags.a).toEqual(["my tag"])
    expect(String(fetchFn.mock.calls[0][1]?.body)).not.toContain("Title a")
  })
  it("calls nothing at all when everything is tagged", async () => {
    const fetchFn = allRock()
    const { tagger } = setup({ tagged: { a: ["x"], b: ["y"] }, fetchFn })
    expect(await tagger.start({ vocabulary: VOCAB })).toMatchObject({ running: false, total: 0 })
    expect(fetchFn).not.toHaveBeenCalled()
  })
  it("sends batches, and keeps each batch's numbering straight", async () => {
    const library = Array.from({ length: BATCH_SIZE + 3 }, (_, i) => song(`s${i}`))
    const fetchFn = allRock()
    const { tagger, tags, finished } = setup({ library, fetchFn })
    await tagger.start({ vocabulary: VOCAB })
    expect(await finished).toMatchObject({ done: BATCH_SIZE + 3, tagged: BATCH_SIZE + 3 })
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(Object.keys(tags)).toHaveLength(BATCH_SIZE + 3)
  })
  it("needs a key first", async () => {
    const { tagger } = setup({ keys: {} })
    await expect(tagger.start({ vocabulary: VOCAB })).rejects.toMatchObject({ code: "AI_KEY_MISSING" })
  })
  it("stops on a bad key, without retrying", async () => {
    const fetchFn = vi.fn(async () => json({ error: { type: "authentication_error" } }, 401))
    const { tagger, finished } = setup({ fetchFn })
    await tagger.start({ vocabulary: VOCAB })
    expect((await finished).error?.code).toBe("AI_KEY_INVALID")
    expect(fetchFn).toHaveBeenCalledOnce()
  })
  it("stops when out of credit, without retrying, keeping earlier work", async () => {
    const library = Array.from({ length: BATCH_SIZE + 1 }, (_, i) => song(`s${i}`))
    const rock = allRock()
    const fetchFn = vi.fn(async (u: string, i?: RequestInit) => (fetchFn.mock.calls.length === 1 ? rock(u, i) : json({ error: { code: "credit_balance_exhausted" } }, 429)))
    const { tagger, tags, finished } = setup({ library, fetchFn })
    await tagger.start({ vocabulary: VOCAB })
    expect((await finished).error?.code).toBe("AI_NO_CREDIT")
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(Object.keys(tags)).toHaveLength(BATCH_SIZE)
  })
  it("waits and retries when rate limited, then carries on", async () => {
    const rock = allRock()
    let first = true
    const fetchFn = vi.fn(async (u: string, i?: RequestInit) => {
      if (first) {
        first = false
        return json({ error: { type: "rate_limit_error" } }, 429, { "retry-after": "1" })
      }
      return rock(u, i)
    })
    const { tagger, tags, finished } = setup({ fetchFn })
    await tagger.start({ vocabulary: VOCAB })
    expect(await finished).toMatchObject({ tagged: 2, error: null })
    expect(tags.a).toEqual(["rock"])
  })
  it("gives up after repeated rate limits, with a clear reason", async () => {
    const fetchFn = vi.fn(async () => json({ error: { type: "rate_limit_error" } }, 429))
    const { tagger, finished } = setup({ fetchFn })
    await tagger.start({ vocabulary: VOCAB })
    expect((await finished).error?.code).toBe("AI_RATE_LIMITED")
    expect(fetchFn).toHaveBeenCalledTimes(5)
  })
  it("carries on past one bad batch and counts it", async () => {
    const library = Array.from({ length: BATCH_SIZE + 1 }, (_, i) => song(`s${i}`))
    const rock = allRock()
    const fetchFn = vi.fn(async (u: string, i?: RequestInit) => (fetchFn.mock.calls.length === 1 ? json({ content: [{ type: "text", text: "not json" }], stop_reason: "end_turn" }) : rock(u, i)))
    const { tagger, finished } = setup({ library, fetchFn })
    await tagger.start({ vocabulary: VOCAB })
    expect(await finished).toMatchObject({ tagged: 1, failed: BATCH_SIZE, error: null })
  })
  it("doesn't overwrite a song tagged by hand while running", async () => {
    const tagsHolder: { tags?: Record<string, string[]> } = {}
    const fetchFn = vi.fn(async (u: string, i?: RequestInit) => {
      tagsHolder.tags!.a = ["by hand"]
      return allRock()(u, i)
    })
    const s = setup({ fetchFn })
    tagsHolder.tags = s.tags
    await s.tagger.start({ vocabulary: VOCAB })
    await s.finished
    expect(s.tags.a).toEqual(["by hand"])
    expect(s.tags.b).toEqual(["rock"])
  })
  it("can be cancelled", async () => {
    const library = Array.from({ length: BATCH_SIZE * 3 }, (_, i) => song(`s${i}`))
    const rock = allRock()
    const s = setup({ library, fetchFn: vi.fn(async (u: string, i?: RequestInit) => { s.tagger.cancel(); return rock(u, i) }) as never })
    await s.tagger.start({ vocabulary: VOCAB })
    expect((await s.finished).running).toBe(false)
    expect(Object.keys(s.tags).length).toBeLessThanOrEqual(BATCH_SIZE)
  })
})

describe("setKey", () => {
  const withStatus = (status: number) => vi.fn(async () => new Response("{}", { status }))
  it("saves a key the provider accepts, and checks it for free", async () => {
    const fetchFn = withStatus(200)
    const { tagger } = setup({ fetchFn })
    await tagger.setKey("anthropic", ` ${KEY}\n`)
    expect(fetchFn.mock.calls[0][0]).toContain("/v1/models")
  })
  it("rejects what the provider rejects", async () => {
    await expect(setup({ fetchFn: withStatus(401) }).tagger.setKey("openai", KEY)).rejects.toMatchObject({ code: "AI_KEY_INVALID" })
  })
  it("doesn't reject a good key over some other hiccup", async () => {
    await expect(setup({ fetchFn: withStatus(500) }).tagger.setKey("openai", KEY)).resolves.toBeTruthy()
  })
  it("rejects junk without calling anyone", async () => {
    const fetchFn = withStatus(200)
    await expect(setup({ fetchFn }).tagger.setKey("openai", "has spaces in it")).rejects.toMatchObject({ code: "AI_KEY_INVALID" })
    expect(fetchFn).not.toHaveBeenCalled()
  })
  it("rejects unknown providers", async () => {
    await expect(setup().tagger.setKey("other", KEY)).rejects.toThrow(/Unknown provider/)
  })
})
