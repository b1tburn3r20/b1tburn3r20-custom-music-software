import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test"
import fs from "fs"
import http from "http"
import os from "os"
import path from "path"
import { createRequire } from "module"
import { fileURLToPath } from "url"

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const { buildTestMp3 } = require("../electron/smoke.cjs")

/** A test MP3 with both title and album tags. */
export function buildTaggedMp3(title: string, album: string) {
  const frame = (id: string, value: string) => {
    const text = Buffer.concat([Buffer.from([0]), Buffer.from(value, "latin1")])
    const head = Buffer.alloc(10)
    head.write(id, 0, "latin1")
    head.writeUInt32BE(text.length, 4)
    return Buffer.concat([head, text])
  }
  const body = Buffer.concat([frame("TIT2", title), frame("TALB", album), frame("TPE1", "Test Artist")])
  const size = [21, 14, 7, 0].map((shift) => (body.length >> shift) & 0x7f)
  const audio = Buffer.alloc(417)
  audio.set([0xff, 0xfb, 0x90, 0x00])
  return Buffer.concat([Buffer.from("ID3", "latin1"), Buffer.from([3, 0, 0, ...size]), body, ...Array(8).fill(audio)])
}

export const shots = path.join(__dirname, "..", "test-results", "screens")
fs.mkdirSync(shots, { recursive: true })
export const shot = (page: Page, name: string) => page.screenshot({ path: path.join(shots, `${name}.png`) })

export const VALID_KEY = "fake-key-for-end-to-end-tests-only"
export const CLIENT_ID = "e2e.apps.googleusercontent.com"
export const MUSIC_VIDEO = { id: "jNQXAC9IVRw", title: "Band - Great Song", channelTitle: "Band" }
export const OTHER_VIDEO = { id: "bbbbbbbbbbb", title: "How to fix a sink", channelTitle: "Handy Person" }

const apiVideo = (v: { id: string; title: string; channelTitle: string }, categoryId = "10") => ({
  id: v.id,
  snippet: { title: v.title, channelTitle: v.channelTitle, categoryId, thumbnails: {} },
  contentDetails: { duration: "PT3M" },
  status: { embeddable: true },
})

/** Stands in for Google: sign-in page, token endpoint and the YouTube API, and records every hit. */
export async function startFakeGoogle(opts: { deny?: boolean } = {}) {
  const state = { hits: [] as string[], deny: opts.deny ?? false, revoked: [] as string[], lastTokenBody: "" }
  const send = (res: http.ServerResponse, body: unknown, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" })
    res.end(JSON.stringify(body))
  }
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url!, "http://127.0.0.1")
    state.hits.push(url.pathname)
    let body = ""
    for await (const chunk of req) body += chunk

    if (url.pathname === "/auth") {
      const back = new URL(url.searchParams.get("redirect_uri")!)
      back.searchParams.set("state", url.searchParams.get("state")!)
      if (state.deny) back.searchParams.set("error", "access_denied")
      else back.searchParams.set("code", "fake-code")
      res.writeHead(302, { Location: back.href })
      return res.end()
    }
    if (url.pathname === "/token") {
      state.lastTokenBody = body
      return send(res, { access_token: "fake-access", refresh_token: "fake-refresh", expires_in: 3600, scope: "https://www.googleapis.com/auth/youtube.readonly" })
    }
    if (url.pathname === "/revoke") {
      state.revoked.push(body)
      return send(res, {})
    }

    const key = req.headers["x-goog-api-key"]
    const signedIn = req.headers.authorization === "Bearer fake-access"
    if (!signedIn && key !== VALID_KEY) return send(res, { error: { code: 400, message: "API key not valid.", errors: [{ reason: "badRequest" }], details: [{ reason: "API_KEY_INVALID" }] } }, 400)
    if (url.pathname === "/api/channels") return send(res, { items: [{ id: "UC1", snippet: { title: "Test Person", thumbnails: {} } }] })
    if (url.pathname === "/api/playlists") return send(res, { items: [{ id: "PLroadtrip", snippet: { title: "Road trip", thumbnails: {} }, contentDetails: { itemCount: 12 } }] })
    if (url.pathname === "/api/subscriptions") return send(res, { items: [{ snippet: { title: "Band - Topic", resourceId: { channelId: "UCband" }, thumbnails: {} } }] })
    if (url.pathname === "/api/search") return send(res, { items: [{ id: { videoId: MUSIC_VIDEO.id } }] })
    if (url.pathname === "/api/videos") {
      if (url.searchParams.get("myRating")) return send(res, { items: [apiVideo(MUSIC_VIDEO), apiVideo(OTHER_VIDEO, "26")] })
      return send(res, { items: [apiVideo(MUSIC_VIDEO)] })
    }
    return send(res, { items: [] })
  })
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  return { state, close: () => server.close(), endpoints: { auth: `${base}/auth`, token: `${base}/token`, revoke: `${base}/revoke`, api: `${base}/api` } }
}

/** Stands in for Claude and OpenAI: tags every song "chill" and records what it was sent. */
export async function startFakeAi() {
  const state = { requests: [] as { path: string; headers: http.IncomingHttpHeaders; body: string }[] }
  const server = http.createServer(async (req, res) => {
    let body = ""
    for await (const chunk of req) body += chunk
    const url = new URL(req.url!, "http://127.0.0.1")
    state.requests.push({ path: url.pathname, headers: req.headers, body })
    const send = (data: unknown, status = 200) => {
      res.writeHead(status, { "Content-Type": "application/json" })
      res.end(JSON.stringify(data))
    }
    const key = req.headers["x-api-key"] ?? req.headers.authorization
    if (String(key).includes("rejected")) return send({ error: { type: "authentication_error", message: "invalid" } }, 401)
    if (url.pathname.endsWith("/v1/models")) return send({ data: [] })
    const songs = [...body.matchAll(/\\"i\\":(\d+)/g)].map((m) => ({ i: Number(m[1]), tags: ["chill", "not a real tag"] }))
    const text = JSON.stringify({ songs })
    if (url.pathname.startsWith("/anthropic")) return send({ content: [{ type: "text", text }], stop_reason: "end_turn" })
    return send({ output: [{ type: "message", content: [{ type: "output_text", text }] }] })
  })
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  return { state, close: () => server.close(), endpoints: { anthropic: `${base}/anthropic`, openai: `${base}/openai` } }
}

export type AppOptions = { ai?: Awaited<ReturnType<typeof startFakeAi>>; google?: Awaited<ReturnType<typeof startFakeGoogle>>; music?: string[]; dir?: string; seedUser?: Record<string, unknown> }

/** The built app, as a brand new user: empty data folder and its own Music folder. */
export async function launch(opts: AppOptions = {}) {
  const dir = opts.dir ?? fs.mkdtempSync(path.join(os.tmpdir(), "b1t-e2e-"))
  const music = path.join(dir, "Music")
  fs.mkdirSync(music, { recursive: true })
  fs.writeFileSync(path.join(dir, "seed.mp3"), buildTestMp3("Great Song"))
  for (const name of opts.music ?? []) fs.writeFileSync(path.join(music, `${name}.mp3`), buildTestMp3(name))
  const data = path.join(dir, "data")
  fs.mkdirSync(data, { recursive: true })
  if (opts.seedUser) fs.writeFileSync(path.join(data, "user.json"), JSON.stringify({ version: 1, playlists: [], likes: [], ...opts.seedUser }))
  const app = await electron.launch({
    args: [path.join(__dirname, "..", "electron", "main.cjs")],
    env: {
      ...(process.env as Record<string, string>),
      B1T_LOAD_DIST: "1",
      B1T_USERDATA_DIR: data,
      B1T_LEGACY_DIR: path.join(dir, "no-legacy"),
      B1T_MUSIC_DIR: music,
      B1T_INSTALL_ROOT: path.join(dir, "install"),
      ...(opts.google ? { B1T_GOOGLE_ENDPOINTS: JSON.stringify(opts.google.endpoints) } : {}),
      ...(opts.ai ? { B1T_AI_ENDPOINTS: JSON.stringify(opts.ai.endpoints) } : {}),
    },
  })
  const page = await app.firstWindow()
  const problems: string[] = []
  page.on("console", (m) => {
    if (/Content Security Policy/i.test(m.text())) problems.push(m.text())
  })
  page.on("pageerror", (e) => problems.push(String(e)))
  await page.waitForFunction(() => (document.getElementById("root")?.childElementCount ?? 0) > 0)
  return { app, page, dir, music, data, problems }
}

export async function close(app: ElectronApplication) {
  await app.close().catch(() => {})
}

export async function skipOnboarding(page: Page) {
  await page.getByRole("button", { name: "Skip setup" }).click()
  await page.getByRole("dialog", { name: "Setup" }).waitFor({ state: "detached" })
}
