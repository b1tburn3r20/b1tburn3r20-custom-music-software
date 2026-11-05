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
    expect(e.message).toMatch(/Update yt-dlp/)
    expect(e.message).not.toMatch(/pacman|-Syu|system/i)
  })
})

describe("a 401 from YouTube", () => {
  // The exact line yt-dlp printed for this, on a real run.
  const LINE = "ERROR: [youtube:tab] playlists: Unable to download API page: HTTP Error 401: Unauthorized (caused by <HTTPError 401: Unauthorized>)"
  it("means the sign-in wasn't accepted, not a failed download", () => {
    const e = y.classifyError(LINE, { authMode: "file" })
    expect(e.code).toBe("AUTH_EXPIRED")
    expect(e.message).not.toMatch(/HTTP|401|caused by/)
  })
  it("asks to sign in when nothing is set up", () => {
    expect(y.classifyError(LINE).code).toBe("SIGN_IN_REQUIRED")
  })
})

describe("hasSignInCookies", () => {
  const line = (name: string, domain = ".youtube.com") => [domain, "TRUE", "/", "TRUE", "1999999999", name, "value"].join("\t")
  it.each(["SAPISID", "APISID", "__Secure-1PAPISID", "__Secure-3PAPISID", "LOGIN_INFO"])("recognises %s", (name) => {
    expect(y.hasSignInCookies(line(name))).toBe(true)
    expect(y.hasSignInCookies(line(name, "#HttpOnly_.youtube.com"))).toBe(true)
  })
  it("sees a signed-out export for what it is", () => {
    expect(y.hasSignInCookies([line("PREF"), line("VISITOR_INFO1_LIVE"), line("YSC")].join("\n"))).toBe(false)
  })
  it("doesn't count another site's cookie of the same name", () => {
    expect(y.hasSignInCookies(line("SAPISID", ".google.com"))).toBe(false)
    expect(y.hasSignInCookies(line("SAPISID", ".notyoutube.com"))).toBe(false)
  })
  it("isn't fooled by the name appearing as a value", () => {
    expect(y.hasSignInCookies([".youtube.com", "TRUE", "/", "TRUE", "1999999999", "PREF", "SAPISID"].join("\t"))).toBe(false)
  })
})

describe("youtubeCookiesOnly", () => {
  const line = (domain: string, name = "SID") => [domain, "TRUE", "/", "TRUE", "1999999999", name, "secret"].join("\t")
  const keep = (text: string) => y.youtubeCookiesOnly(text) as string

  it("keeps YouTube and Google sign-in cookies, including HttpOnly ones", () => {
    const out = keep([line(".youtube.com"), line("#HttpOnly_.youtube.com", "HSID"), line(".google.com", "NID"), line("accounts.google.com", "LSID")].join("\n"))
    expect(out.split("\n").filter((l) => l.includes("\t"))).toHaveLength(4)
  })
  it("drops every other site's sessions", () => {
    const out = keep([line(".youtube.com"), line(".mybank.com", "BANK"), line("mail.example.org", "MAIL")].join("\n"))
    expect(out).not.toContain("BANK")
    expect(out).not.toContain("MAIL")
  })
  it("isn't fooled by look-alike domains", () => {
    const out = keep([line("notyoutube.com", "A"), line("youtube.com.evil.net", "B"), line(".evilgoogle.com", "C")].join("\n"))
    expect(out.split("\n").filter((l) => l.includes("\t"))).toHaveLength(0)
  })
  it("starts with the line yt-dlp requires, and handles Windows line endings", () => {
    const out = keep("# Netscape HTTP Cookie File\r\n# a comment\r\n" + line(".youtube.com") + "\r\n")
    expect(out.split("\n")[0]).toBe("# Netscape HTTP Cookie File")
    expect(out).not.toContain("\r")
    expect(out).not.toContain("a comment")
    expect(out).toContain("secret")
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
