import { describe, expect, it } from "vitest"
import { parseISODuration, parseYoutubeUrl } from "./youtubeApi"

describe("parseISODuration", () => {
  it("handles hours, minutes, seconds and days", () => {
    expect(parseISODuration("PT4M12S")).toBe(252)
    expect(parseISODuration("PT1H2M3S")).toBe(3723)
    expect(parseISODuration("PT2H")).toBe(7200)
    expect(parseISODuration("P1DT1S")).toBe(86401)
    expect(parseISODuration("PT45S")).toBe(45)
    expect(parseISODuration("")).toBe(0)
  })
})

describe("parseYoutubeUrl", () => {
  it("extracts video and playlist ids", () => {
    expect(parseYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc_123")).toEqual({ videoId: "dQw4w9WgXcQ", playlistId: "PLabc_123" })
    expect(parseYoutubeUrl("https://youtu.be/dQw4w9WgXcQ?t=3")).toEqual({ videoId: "dQw4w9WgXcQ", playlistId: undefined })
    expect(parseYoutubeUrl("https://music.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({ videoId: "dQw4w9WgXcQ", playlistId: undefined })
    expect(parseYoutubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ").videoId).toBe("dQw4w9WgXcQ")
    expect(parseYoutubeUrl("PLxyz-ABC").playlistId).toBe("PLxyz-ABC")
    expect(parseYoutubeUrl("not a link")).toEqual({ videoId: undefined, playlistId: undefined })
  })
})
