import { describe, expect, it } from "vitest"
import { bandLabel, cleanGains, EQ_BANDS, EQ_MAX_DB, EQ_PRESETS, eqPreamp, matchingPreset } from "./equalizer"

describe("equalizer", () => {
  it("has a setting for every band in every preset, within range", () => {
    for (const p of EQ_PRESETS) {
      expect(p.gains).toHaveLength(EQ_BANDS.length)
      for (const g of p.gains) expect(Math.abs(g)).toBeLessThanOrEqual(EQ_MAX_DB)
    }
  })
  it("recognizes a preset, and not hand-adjusted settings", () => {
    expect(matchingPreset(EQ_PRESETS[1].gains)).toBe(EQ_PRESETS[1].id)
    expect(matchingPreset([1, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBeNull()
  })
  it("survives bad saved data", () => {
    expect(cleanGains(undefined)).toHaveLength(10)
    expect(cleanGains([99, -99, "x"]).slice(0, 3)).toEqual([EQ_MAX_DB, -EQ_MAX_DB, 0])
  })
  it("turns down by the largest boost, and leaves cuts alone", () => {
    expect(eqPreamp([6, 0, -3])).toBeCloseTo(0.501, 2)
    expect(eqPreamp([-6, -3])).toBe(1)
  })
  it("labels bands the short way", () => {
    expect(bandLabel(62)).toBe("62")
    expect(bandLabel(16000)).toBe("16k")
  })
})
