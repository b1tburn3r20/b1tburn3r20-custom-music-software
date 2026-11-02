import { createRequire } from "module"
import fs from "fs"
import os from "os"
import path from "path"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const y = require("./ytdlp.cjs")

describe("classifyError", () => {
  it("detects expired cookies", () => {
    const e = y.classifyError("WARNING: The provided YouTube account cookies are no longer valid. They have likely been rotated\nERROR: [youtube] x: Sign in to confirm your age", { authMode: "file" })
    expect(e.code).toBe("AUTH_EXPIRED")
  })
  it("asks to sign in when not signed in and the video is age-restricted", () => {
    expect(y.classifyError("ERROR: [youtube] abc: Sign in to confirm your age. This video may be inappropriate for some users.").code).toBe("SIGN_IN_REQUIRED")
  })
  it("treats a sign-in prompt as expired auth when sign-in is configured", () => {
    expect(y.classifyError("ERROR: [youtube] abc: Sign in to confirm you're not a bot", { authMode: "browser" }).code).toBe("AUTH_EXPIRED")
  })
  it("detects a locked/unreadable browser cookie database", () => {
    expect(y.classifyError("ERROR: Could not copy Chrome cookie database. See  https://github.com/yt-dlp/yt-dlp/issues/7271", { authMode: "browser" }).code).toBe("BROWSER_COOKIES_UNAVAILABLE")
  })
  it("detects private videos, rate limits and network failures", () => {
    expect(y.classifyError("ERROR: [youtube] abc: Private video. Sign in if you've been granted access").code).toBe("PRIVATE_VIDEO")
    expect(y.classifyError("ERROR: unable to download video data: HTTP Error 429: Too Many Requests").code).toBe("RATE_LIMITED")
    expect(y.classifyError("ERROR: Unable to download webpage: <urlopen error [Errno -3] Temporary failure in name resolution> (caused by getaddrinfo)").code).toBe("NETWORK")
  })
  it("falls back to the last ERROR line", () => {
    const e = y.classifyError("blah\nERROR: something odd happened")
    expect(e.code).toBe("DOWNLOAD_FAILED")
    expect(e.message).toBe("something odd happened")
  })
})

describe("JS challenge failures", () => {
  it("explains an outdated yt-dlp-ejs solver instead of 'no formats'", () => {
    const stderr = "WARNING: [youtube] [jsc:deno] Challenge solver lib script version 0.5.0 is not supported (source: python package, variant: ScriptVariant.MINIFIED, supported version: 0.8.0)\nWARNING: [youtube] x: n challenge solving failed: Some formats may be missing.\nERROR: [youtube] x: No video formats found!"
    const e = y.classifyError(stderr, { authMode: "file" })
    expect(e.code).toBe("YTDLP_JS_CHALLENGE")
    expect(e.message).toMatch(/0\.5\.0.*0\.8\.0/)
    expect(e.message).toMatch(/pacman -Syu/)
  })
})

describe("authArgs / redactArgs", () => {
  it("builds browser args with an optional profile", () => {
    expect(y.authArgs({ mode: "browser", browser: "brave", profile: "" }, "/x")).toEqual(["--cookies-from-browser", "brave"])
    expect(y.authArgs({ mode: "browser", browser: "chrome", profile: "Profile 1" }, "/x")).toEqual(["--cookies-from-browser", "chrome:Profile 1"])
    expect(() => y.authArgs({ mode: "browser", browser: "netscape" }, "/x")).toThrow()
  })
  it("requires an imported cookies file in file mode", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "b1t-"))
    expect(() => y.authArgs({ mode: "file" }, dir)).toThrow(/No cookies file/)
    fs.mkdirSync(path.join(dir, "credentials"))
    fs.writeFileSync(path.join(dir, "credentials", "youtube-cookies.txt"), "# Netscape HTTP Cookie File\n")
    expect(y.authArgs({ mode: "file" }, dir)).toEqual(["--cookies", path.join(dir, "credentials", "youtube-cookies.txt")])
  })
  it("never logs credential arguments", () => {
    expect(y.redactArgs(["-J", "--cookies", "/secret/path.txt", "--cookies-from-browser", "chrome:Work", "url"])).toEqual(["-J", "--cookies", "<redacted>", "--cookies-from-browser", "<redacted>", "url"])
  })
})
