import { describe, expect, it } from "vitest"
import { positionToStore, resumePosition } from "./resume"

const H = 3600
describe("resume positions", () => {
  it("resumes long tracks from the saved position", () => {
    expect(resumePosition(1 * H + 15 * 60, 10 * H)).toBe(4500) // audiobook stopped at 1:15:00
    expect(resumePosition(300, 12 * 60)).toBe(300)
  })
  it("never resumes songs under 10 minutes", () => {
    expect(resumePosition(120, 9 * 60 + 59)).toBeNull()
    expect(positionToStore(120, 4 * 60)).toBeNull()
  })
  it("starts over when stopped at (or very near) the end", () => {
    expect(resumePosition(10 * H - 20, 10 * H)).toBeNull() // within 1% (6 min) of a 10 h book
    expect(resumePosition(12 * 60 - 10, 12 * 60)).toBeNull() // within 30 s
    expect(positionToStore(12 * 60 - 5, 12 * 60)).toBeNull()
  })
  it("ignores positions in the first seconds", () => {
    expect(resumePosition(4, H)).toBeNull()
    expect(positionToStore(4, H)).toBeNull()
    expect(positionToStore(1234.7, H)).toBe(1234)
  })
})
