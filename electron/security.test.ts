import { createRequire } from "module"
import Module from "module"
import { describe, expect, it } from "vitest"

// security.cjs needs only `shell` from electron, and these tests never call it.
const load = Module.prototype.require
Module.prototype.require = function (id: string) {
  return id === "electron" ? { shell: {} } : load.call(this, id)
}
const require = createRequire(import.meta.url)
const { isExternalWebUrl, isTrustedSender, isTrustedUrl } = require("./security.cjs")
Module.prototype.require = load

const PAGE = "file:///C:/Program%20Files/b1t/resources/app.asar/dist/index.html"
const frame = (url: string, parent: unknown = null) => ({ senderFrame: { url, parent } })

describe("isTrustedSender", () => {
  it("accepts the app's own page, whatever its hash or query", () => {
    expect(isTrustedSender(frame(PAGE), PAGE)).toBe(true)
    expect(isTrustedSender(frame(`${PAGE}#/home?x=1`), PAGE)).toBe(true)
  })

  it("accepts the dev server only when that is the trusted page", () => {
    expect(isTrustedSender(frame("http://localhost:5173/"), "http://localhost:5173/")).toBe(true)
    expect(isTrustedSender(frame("http://localhost:5173/"), PAGE)).toBe(false)
  })

  it.each([
    ["a remote site", "https://music.youtube.com/"],
    ["another local file", "file:///C:/Users/me/Downloads/evil.html"],
    ["a data URL", "data:text/html,<script></script>"],
    ["an empty URL", ""],
  ])("rejects %s", (_name, url) => {
    expect(isTrustedSender(frame(url), PAGE)).toBe(false)
  })

  it("rejects an embedded frame, even at the trusted URL", () => {
    expect(isTrustedSender(frame(PAGE, {}), PAGE)).toBe(false)
  })

  it("rejects a sender whose frame is gone", () => {
    expect(isTrustedSender({ senderFrame: null }, PAGE)).toBe(false)
    expect(isTrustedSender(undefined, PAGE)).toBe(false)
  })
})

describe("isTrustedUrl", () => {
  it("is closed until a trusted page has been set", () => {
    expect(isTrustedUrl(PAGE, null)).toBe(false)
  })
})

describe("isExternalWebUrl", () => {
  it("only lets https links out to the browser", () => {
    expect(isExternalWebUrl("https://music.youtube.com/search?q=x")).toBe(true)
    for (const url of ["http://example.com", "file:///C:/Windows/System32/calc.exe", "javascript:alert(1)", "smb://host/share", "not a url"]) {
      expect(isExternalWebUrl(url)).toBe(false)
    }
  })
})
