import { createRequire } from "module"
import crypto from "crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"

const require = createRequire(import.meta.url)
const { createGoogleAuth, createPkce, parseClient, SCOPE } = require("./oauth.cjs")

const CLIENT = JSON.stringify({ clientId: "abc.apps.googleusercontent.com", clientSecret: "shh" })
const ENDPOINTS = { auth: "https://google.test/auth", token: "https://google.test/token", revoke: "https://google.test/revoke" }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const GOOD_TOKENS = { access_token: "access-1", refresh_token: "refresh-1", expires_in: 3600, scope: SCOPE }

function memoryCredentials(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    get: async (k: string) => data.get(k) ?? null,
    set: vi.fn(async (k: string, v: string) => {
      data.set(k, v)
      return { persisted: true }
    }),
    remove: vi.fn(async (k: string) => {
      data.delete(k)
    }),
    data,
  }
}

/** Stands in for the user's browser: captures the sign-in URL, then visits the redirect. */
function browser() {
  let resolveUrl: (u: URL) => void
  const opened = new Promise<URL>((r) => (resolveUrl = r))
  return { open: vi.fn(async (u: string) => resolveUrl(new URL(u))), opened }
}
const callback = (authUrl: URL, params: Record<string, string>, path = "/callback") => fetch(`${authUrl.searchParams.get("redirect_uri")!.replace("/callback", path)}?${new URLSearchParams(params)}`)
const state = (authUrl: URL) => authUrl.searchParams.get("state")!

function setup(fetchFn: (url: string, init?: RequestInit) => Promise<Response> = async () => json(GOOD_TOKENS), initial: Record<string, string> = { oauthClient: CLIENT }, extra: Record<string, unknown> = {}) {
  const b = browser()
  const credentials = memoryCredentials(initial)
  const spyFetch = vi.fn(fetchFn)
  const onChange = vi.fn()
  const auth = createGoogleAuth({ credentials, openExternal: b.open, fetchFn: spyFetch, endpoints: ENDPOINTS, onChange, ...extra })
  return { auth, credentials, b, fetchFn: spyFetch, onChange }
}
const connected = { oauthClient: CLIENT, oauthToken: JSON.stringify({ refreshToken: "refresh-1" }) }

describe("parseClient", () => {
  it("reads Google's downloaded JSON", () => {
    const text = JSON.stringify({ installed: { client_id: "x.apps.googleusercontent.com", client_secret: "s" } })
    expect(parseClient(text)).toEqual({ clientId: "x.apps.googleusercontent.com", clientSecret: "s" })
  })
  it("reads an ID and secret entered separately, and trims them", () => {
    expect(parseClient({ clientId: " x.apps.googleusercontent.com\n", clientSecret: " s " })).toEqual({ clientId: "x.apps.googleusercontent.com", clientSecret: "s" })
  })
  it("explains when a Web client was created by mistake", () => {
    expect(() => parseClient(JSON.stringify({ web: { client_id: "x.apps.googleusercontent.com" } }))).toThrow(/Desktop app/)
  })
  it("rejects anything that isn't a client ID", () => {
    expect(() => parseClient({ clientId: "nope" })).toThrow(/client ID/)
    expect(() => parseClient("not json")).toThrow(/JSON/)
    expect(() => parseClient(JSON.stringify({ installed: { client_id: "https://evil.example/x.apps.googleusercontent.com" } }))).toThrow(/client ID/)
  })
})

describe("createPkce", () => {
  it("makes an S256 challenge from a high-entropy, URL-safe verifier", () => {
    const { verifier, challenge } = createPkce()
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(challenge).toBe(crypto.createHash("sha256").update(verifier).digest("base64url"))
    expect(createPkce().verifier).not.toBe(verifier)
  })
})

describe("connect", () => {
  it("asks for only the read-only scope, using PKCE, offline access and a loopback redirect", async () => {
    const { auth, b } = setup()
    const done = auth.connect()
    const url = await b.opened
    expect(url.origin + url.pathname).toBe(ENDPOINTS.auth)
    expect(url.searchParams.get("scope")).toBe(SCOPE)
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("access_type")).toBe("offline")
    expect(url.searchParams.get("redirect_uri")).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/)
    expect(state(url).length).toBeGreaterThanOrEqual(32)
    await callback(url, { state: state(url), code: "c" })
    await done
  })

  it("exchanges the code with the matching verifier, and stores only the refresh token", async () => {
    const { auth, b, credentials, fetchFn } = setup()
    const done = auth.connect()
    const url = await b.opened
    const page = await callback(url, { state: state(url), code: "the-code" })
    expect(await page.text()).toContain("You're connected")
    await done
    const [tokenUrl, init] = fetchFn.mock.calls[0]
    expect(tokenUrl).toBe(ENDPOINTS.token)
    const sent = new URLSearchParams(String(init!.body))
    expect(sent.get("code")).toBe("the-code")
    expect(crypto.createHash("sha256").update(sent.get("code_verifier")!).digest("base64url")).toBe(url.searchParams.get("code_challenge"))
    expect(sent.get("client_secret")).toBe("shh")
    expect(JSON.parse(credentials.data.get("oauthToken")!)).toEqual({ refreshToken: "refresh-1" })
    expect(credentials.data.get("oauthToken")).not.toContain("access-1")
    expect(await auth.status()).toMatchObject({ connected: true, needsReconnect: false })
  })

  it("leaves out the secret when the client has none", async () => {
    const { auth, b, fetchFn } = setup(undefined, { oauthClient: JSON.stringify({ clientId: "a.apps.googleusercontent.com", clientSecret: "" }) })
    const done = auth.connect()
    const url = await b.opened
    await callback(url, { state: state(url), code: "c" })
    await done
    expect(new URLSearchParams(String(fetchFn.mock.calls[0][1]!.body)).has("client_secret")).toBe(false)
  })

  it("treats denied access as a clear outcome, not a crash", async () => {
    const { auth, b, credentials } = setup()
    const done = auth.connect()
    const url = await b.opened
    const page = await callback(url, { state: state(url), error: "access_denied" })
    expect(await page.text()).toContain("Nothing was connected")
    await expect(done).rejects.toMatchObject({ code: "CONNECT_DENIED" })
    expect(credentials.data.has("oauthToken")).toBe(false)
  })

  it("ignores a forged callback and keeps waiting for the real one", async () => {
    const { auth, b, fetchFn } = setup()
    const done = auth.connect()
    const url = await b.opened
    const forged = await callback(url, { state: "wrong", code: "attacker-code" })
    expect(forged.status).toBe(400)
    expect(fetchFn).not.toHaveBeenCalled()
    await callback(url, { state: state(url), code: "real" })
    await done
    expect(new URLSearchParams(String(fetchFn.mock.calls[0][1]!.body)).get("code")).toBe("real")
  })

  it("answers nothing useful on other paths", async () => {
    const { auth, b } = setup()
    const done = auth.connect()
    const url = await b.opened
    expect((await callback(url, { state: state(url), code: "c" }, "/other")).status).toBe(404)
    await callback(url, { state: state(url), code: "c" })
    await done
  })

  it("never writes request data into its pages", async () => {
    const { auth, b } = setup()
    const done = auth.connect()
    const url = await b.opened
    const page = await (await callback(url, { state: "<script>alert(1)</script>", code: "<b>x</b>" })).text()
    expect(page).not.toContain("alert(1)")
    expect(page).not.toContain("<b>x</b>")
    await callback(url, { state: state(url), code: "c" })
    await done
  })

  it("rejects a sign-in where the YouTube permission was unticked", async () => {
    const { auth, b, credentials } = setup(async () => json({ ...GOOD_TOKENS, scope: "openid email" }))
    const done = auth.connect()
    const url = await b.opened
    await callback(url, { state: state(url), code: "c" })
    await expect(done).rejects.toMatchObject({ code: "SCOPE_NOT_GRANTED" })
    expect(credentials.data.has("oauthToken")).toBe(false)
  })

  it("can be cancelled, and closes its listener", async () => {
    const { auth, b } = setup()
    const done = auth.connect()
    const url = await b.opened
    auth.cancelConnect()
    await expect(done).rejects.toMatchObject({ code: "CONNECT_CANCELLED" })
    await expect(callback(url, { state: state(url), code: "c" })).rejects.toThrow()
  })

  it("times out and names the likely cause, since a blocked client never redirects back", async () => {
    const { auth, b } = setup(undefined, undefined, { timeoutMs: 20 })
    const done = auth.connect()
    await b.opened
    await expect(done).rejects.toMatchObject({ code: "CONNECT_TIMEOUT", message: expect.stringContaining("Google Cloud Console") })
  })

  it("shares one attempt if Connect is clicked twice", async () => {
    const { auth, b } = setup()
    const first = auth.connect()
    const second = auth.connect()
    expect(second).toBe(first)
    const url = await b.opened
    expect(b.open).toHaveBeenCalledOnce()
    await callback(url, { state: state(url), code: "c" })
    await first
  })

  it("needs a client first", async () => {
    await expect(setup(undefined, {}).auth.connect()).rejects.toMatchObject({ code: "CLIENT_MISSING" })
  })
})

describe("accessToken", () => {
  const renewed = (n = 1) => async () => json({ access_token: `access-${n}`, expires_in: 3600 })

  it("refreshes once, however many callers ask at the same time", async () => {
    const { auth, fetchFn } = setup(renewed(), connected)
    const tokens = await Promise.all([auth.accessToken(), auth.accessToken(), auth.accessToken()])
    expect(tokens).toEqual(["access-1", "access-1", "access-1"])
    expect(fetchFn).toHaveBeenCalledOnce()
  })

  it("reuses a valid token, and renews it just before it expires", async () => {
    let time = 0
    let n = 0
    const { auth, fetchFn } = setup(async () => json({ access_token: `access-${++n}`, expires_in: 3600 }), connected, { now: () => time })
    expect(await auth.accessToken()).toBe("access-1")
    time = 3000 * 1000
    expect(await auth.accessToken()).toBe("access-1")
    expect(fetchFn).toHaveBeenCalledOnce()
    time = 3599 * 1000
    expect(await auth.accessToken()).toBe("access-2")
  })

  it("on invalid_grant, forgets the token and asks to reconnect", async () => {
    const { auth, credentials, onChange } = setup(async () => json({ error: "invalid_grant" }, 400), connected)
    await expect(auth.accessToken()).rejects.toMatchObject({ code: "NEEDS_RECONNECT", message: expect.stringContaining("Testing") })
    expect(credentials.data.has("oauthToken")).toBe(false)
    expect(credentials.data.has("oauthClient")).toBe(true)
    expect(await auth.status()).toMatchObject({ connected: false, needsReconnect: true, hasClient: true })
    expect(onChange).toHaveBeenCalled()
  })

  it("keeps the token through a network failure", async () => {
    const { auth, credentials } = setup(async () => {
      throw new Error("offline")
    }, connected)
    await expect(auth.accessToken()).rejects.toMatchObject({ code: "NETWORK" })
    expect(credentials.data.has("oauthToken")).toBe(true)
    expect(await auth.status()).toMatchObject({ connected: true, needsReconnect: false })
  })

  it("keeps the token when the client is rejected, which may be temporary", async () => {
    const { auth, credentials } = setup(async () => json({ error: "disabled_client" }, 401), connected)
    await expect(auth.accessToken()).rejects.toMatchObject({ code: "CLIENT_REJECTED", message: expect.stringContaining("still work") })
    expect(credentials.data.has("oauthToken")).toBe(true)
  })

  it("says so when nothing is connected", async () => {
    await expect(setup().auth.accessToken()).rejects.toMatchObject({ code: "NOT_CONNECTED" })
  })
})

describe("authorizedFetch", () => {
  it("renews and retries once on a 401", async () => {
    let n = 0
    const { auth, fetchFn } = setup(async (url) => {
      if (url === ENDPOINTS.token) return json({ access_token: `access-${++n}`, expires_in: 3600 })
      return new Response("{}", { status: n === 1 ? 401 : 200 })
    }, connected)
    const res = await auth.authorizedFetch("https://api.test/x")
    expect(res.status).toBe(200)
    const headers = fetchFn.mock.calls.filter(([u]) => u !== ENDPOINTS.token).map(([, i]) => (i!.headers as Record<string, string>).Authorization)
    expect(headers).toEqual(["Bearer access-1", "Bearer access-2"])
  })

  it("doesn't retry forever", async () => {
    const { auth, fetchFn } = setup(async (url) => (url === ENDPOINTS.token ? json({ access_token: "a", expires_in: 3600 }) : new Response("{}", { status: 401 })), connected)
    expect((await auth.authorizedFetch("https://api.test/x")).status).toBe(401)
    expect(fetchFn.mock.calls.filter(([u]) => u !== ENDPOINTS.token)).toHaveLength(2)
  })
})

describe("disconnect", () => {
  it("revokes at Google and removes the token, but keeps the client", async () => {
    const { auth, credentials, fetchFn } = setup(async () => new Response("{}"), connected)
    expect(await auth.disconnect()).toEqual({ revoked: true })
    expect(fetchFn.mock.calls[0][0]).toBe(ENDPOINTS.revoke)
    expect(String(fetchFn.mock.calls[0][1]!.body)).toContain("token=refresh-1")
    expect(credentials.data.has("oauthToken")).toBe(false)
    expect(credentials.data.has("oauthClient")).toBe(true)
  })
  it("still removes it locally when Google can't be reached, and reports that", async () => {
    const { auth, credentials } = setup(async () => {
      throw new Error("offline")
    }, connected)
    expect(await auth.disconnect()).toEqual({ revoked: false })
    expect(credentials.data.has("oauthToken")).toBe(false)
  })
  it("counts an already-invalid token as revoked", async () => {
    expect(await setup(async () => new Response("{}", { status: 400 }), connected).auth.disconnect()).toEqual({ revoked: true })
  })
  it("forgets the access token in memory too", async () => {
    const { auth } = setup(async (url) => (url === ENDPOINTS.token ? json({ access_token: "a", expires_in: 3600 }) : new Response("{}")), connected)
    await auth.accessToken()
    await auth.disconnect()
    await expect(auth.accessToken()).rejects.toMatchObject({ code: "NOT_CONNECTED" })
  })
  it("removes the client as well when asked", async () => {
    const { auth, credentials } = setup(async () => new Response("{}"), connected)
    await auth.removeClient()
    expect(credentials.data.size).toBe(0)
  })
})

describe("setClient", () => {
  it("clears a sign-in that belonged to a different client", async () => {
    const { auth, credentials } = setup(undefined, connected)
    await auth.setClient({ clientId: "new.apps.googleusercontent.com", clientSecret: "s" })
    expect(credentials.data.has("oauthToken")).toBe(false)
  })
  it("keeps the sign-in when the same client is saved again", async () => {
    const { auth, credentials } = setup(undefined, connected)
    await auth.setClient({ clientId: "abc.apps.googleusercontent.com", clientSecret: "shh" })
    expect(credentials.data.has("oauthToken")).toBe(true)
  })
})

beforeEach(() => {
  vi.restoreAllMocks()
})
