import { createRequire } from "module"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const { isMix, mixUrl, videoFromInfo } = require("./service.cjs")
const { classifyError } = require("./ytdlp.cjs")

describe("isMix", () => {
  it("recognises YouTube's generated mixes", () => {
    expect(isMix("RDdQw4w9WgXcQ")).toBe(true)
    expect(isMix("RDMMdQw4w9WgXcQ")).toBe(true)
    expect(isMix("RDEMabc")).toBe(true)
  })
  it("leaves ordinary playlists alone, including album ones that also start with RD", () => {
    expect(isMix("PLabc123")).toBe(false)
    expect(isMix("LL")).toBe(false)
    expect(isMix("RDCLAK5uy_abc")).toBe(false)
  })
})

describe("mixUrl", () => {
  it("opens a mix from its video, the only way YouTube allows", () => {
    expect(mixUrl("RDMMxyz", "dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDMMxyz")
  })
  it("works out the video when only the mix id was pasted", () => {
    expect(mixUrl("RDdQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ")
  })
  it("explains when there's no video to open it from", () => {
    expect(() => mixUrl("RDMMxyz")).toThrow(/page where the mix is playing/)
  })
  it("won't build a link from something that isn't a video id", () => {
    expect(() => mixUrl("RDabc", "bad id &x=1")).toThrow()
  })
})

describe("yt-dlp's answer for a playlist that can't be opened", () => {
  it("becomes something a person can act on", () => {
    const e = classifyError("ERROR: [youtube:tab] RDxyz: YouTube said: This playlist type is unviewable.")
    expect(e.code).toBe("PLAYLIST_UNAVAILABLE")
    expect(e.message).toMatch(/Copy the link/)
  })
})

describe("videoFromInfo", () => {
  it("reads what yt-dlp reports for a video", () => {
    expect(videoFromInfo({ id: "abc", title: "Song", channel: "Band", duration: 201.4, thumbnail: "u" })).toEqual({ id: "abc", title: "Song", channel: "Band", duration: 201.4, thumbnail: "u" })
  })
  it("falls back when details are missing", () => {
    expect(videoFromInfo({ id: "abc", uploader: "Someone", thumbnails: [{ url: "small", width: 10 }, { url: "big", width: 100 }] })).toEqual({ id: "abc", title: "abc", channel: "Someone", duration: 0, thumbnail: "big" })
  })
  it("doesn't claim anything about previews, so the card still offers one", () => {
    expect(videoFromInfo({ id: "abc" }).embeddable).toBeUndefined()
  })
})
