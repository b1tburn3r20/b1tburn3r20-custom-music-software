import { describe, expect, it } from "vitest"
import { nearSeekBar, SEEK_REACH_ABOVE, SEEK_REACH_BELOW } from "./seekReach"

describe("nearSeekBar", () => {
  const top = 500
  const bottom = 504
  it("reaches well above the bar, over the page", () => {
    expect(nearSeekBar(top - SEEK_REACH_ABOVE, top, bottom)).toBe(true)
    expect(nearSeekBar(top - SEEK_REACH_ABOVE - 1, top, bottom)).toBe(false)
  })
  it("barely reaches below it, where the player's buttons are", () => {
    expect(nearSeekBar(bottom + SEEK_REACH_BELOW, top, bottom)).toBe(true)
    expect(nearSeekBar(bottom + SEEK_REACH_BELOW + 1, top, bottom)).toBe(false)
    expect(SEEK_REACH_BELOW).toBeLessThan(SEEK_REACH_ABOVE / 4)
  })
})
