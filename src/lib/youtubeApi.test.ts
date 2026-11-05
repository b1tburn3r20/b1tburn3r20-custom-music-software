import { describe, expect, it } from "vitest"
import { parseYoutubeUrl } from "./youtubeApi"

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
