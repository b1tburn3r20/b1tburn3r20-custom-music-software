import { createRequire } from "module"
import { EventEmitter } from "events"
import fs from "fs"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const require = createRequire(import.meta.url)
const { createErrorLog, redact } = require("./errorLog.cjs")

describe("redact", () => {
  it.each([
    ["AIzaSyA1234567890abcdefghijklmnop", "AIzaSy"],
    ["sk-ant-api03-abcdefghijklmnop", "abcdefghijklmnop"],
    ["Authorization: Bearer abc.def", "abc.def"],
    ["https://x.test/?key=hunter2&part=id", "hunter2"],
    ['{"refresh_token":"fake-refresh"}', "fake-refresh"],
    ["SAPISID=topsecret; other", "topsecret"],
  ])("takes the secret out of %s", (text, secret) => {
    expect(redact(text)).not.toContain(secret)
  })
  it("leaves useful detail alone", () => {
    const text = "[yt-dlp] exit 1 (DOWNLOAD_FAILED) code=YOUTUBE_REFUSED for video jNQXAC9IVRw"
    expect(redact(text)).toBe(text)
  })
})

describe("createErrorLog", () => {
  let dir: string
  let file: string
  const read = () => fs.readFileSync(file, "utf-8")
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "b1t-log-"))
    file = path.join(dir, "logs", "errors.log")
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it("creates its folder, and records the error's stack without its secrets", () => {
    createErrorLog(file).record("test", "failed", new Error("key=hunter2 went wrong"))
    expect(read()).toContain("[test] failed Error: key=<redacted> went wrong")
    expect(read()).toContain("errorLog.test")
  })

  it("doesn't let a repeating error bury everything, but records it again later", () => {
    let t = 1000
    const log = createErrorLog(file, { now: () => t })
    log.record("test", "same")
    t += 1000
    log.record("test", "same")
    expect(read().match(/same/g)).toHaveLength(1)
    t += 120000
    log.record("test", "same")
    expect(read().match(/same/g)).toHaveLength(2)
  })

  it("starts a new file once it's large, keeping one old one", () => {
    const log = createErrorLog(file, { maxBytes: 50 })
    log.record("test", "x".repeat(100))
    log.record("test", "second")
    expect(read()).toContain("second")
    expect(fs.existsSync(`${file}.old`)).toBe(true)
  })

  it("never throws, even when it can't write", () => {
    fs.writeFileSync(path.join(dir, "logs"), "a file where the folder should be")
    expect(() => createErrorLog(file).record("test", "x")).not.toThrow()
  })

  it("records the system it's running on", () => {
    createErrorLog(file).start("1.2.3")
    expect(read()).toContain(`started 1.2.3 on ${process.platform}`)
  })

  it("records console errors and warnings, which still reach the console, and uncaught failures", () => {
    const proc = new EventEmitter()
    const realError = vi.fn()
    const con = { error: realError, warn: vi.fn() }
    createErrorLog(file).captureProcess(proc, con)
    con.error("[ipc] failed:", new Error("boom"))
    con.warn("careful")
    proc.emit("uncaughtExceptionMonitor", new Error("crashed"))
    proc.emit("unhandledRejection", "rejected")
    expect(realError).toHaveBeenCalled()
    for (const expected of ["[main error] [ipc] failed: Error: boom", "[main warning] careful", "[main crash] Error: crashed", "[main unhandled] rejected"]) expect(read()).toContain(expected)
  })

  it("records the page's errors and crashes, but not its chatter", () => {
    const win = Object.assign(new EventEmitter(), { webContents: new EventEmitter() })
    createErrorLog(file).watchWindow(win)
    win.webContents.emit("console-message", { level: "error", message: "page broke", sourceId: "file:///x/app.js", lineNumber: 7 })
    win.webContents.emit("console-message", { level: "info", message: "just saying" })
    win.webContents.emit("render-process-gone", {}, { reason: "oom" })
    win.emit("unresponsive")
    expect(read()).toContain("[page error] page broke (app.js:7)")
    expect(read()).not.toContain("just saying")
    expect(read()).toContain('[page crash] {"reason":"oom"}')
    expect(read()).toContain("[page frozen]")
  })
})
