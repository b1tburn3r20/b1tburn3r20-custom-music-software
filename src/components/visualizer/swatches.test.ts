import { describe, expect, it } from "vitest"
import { albumColors, pickSwatches } from "./swatches"

/** RGBA pixels: `parts` = [[r,g,b], count] */
function image(parts: [[number, number, number], number][]) {
  const n = parts.reduce((a, [, c]) => a + c, 0)
  const data = new Uint8ClampedArray(n * 4)
  let i = 0
  for (const [[r, g, b], count] of parts) for (let k = 0; k < count; k++, i += 4) data.set([r, g, b, 255], i)
  return data
}

describe("pickSwatches", () => {
  it("finds the cover's main colors, most prominent first", () => {
    const s = pickSwatches(image([[[200, 30, 40], 600], [[30, 60, 200], 300], [[240, 200, 40], 100]]))
    expect(s).toHaveLength(3)
    expect(Math.min(s[0].h, 360 - s[0].h)).toBeLessThan(10) // red (hue wraps at 360)
    expect(s[1].h).toBeGreaterThan(215) // blue
    expect(s[1].h).toBeLessThan(235)
    expect(s[2].h).toBeGreaterThan(45) // yellow
    expect(s[2].h).toBeLessThan(55)
  })

  it("keeps a vivid accent even on a mostly grey cover", () => {
    const s = pickSwatches(image([[[120, 120, 120], 800], [[230, 40, 160], 120]]))
    expect(s.some((c) => c.s > 60 && c.h > 310 && c.h < 330)).toBe(true)
  })

  it("returns greys for a black-and-white cover, and merges near-identical shades", () => {
    const s = pickSwatches(image([[[20, 20, 20], 500], [[24, 22, 22], 300], [[230, 230, 230], 200]]))
    expect(s).toHaveLength(2)
    expect(s.every((c) => c.s < 20)).toBe(true)
  })

  it("ignores specks below 2% of the image", () => {
    expect(pickSwatches(image([[[200, 30, 40], 990], [[30, 200, 40], 10]]))).toHaveLength(1)
  })
})

describe("albumColors", () => {
  const colors = (parts: [[number, number, number], number][]) => albumColors(pickSwatches(image(parts)))

  it("uses only the cover's real colors, leaving out its black and white", () => {
    const c = colors([[[10, 10, 10], 500], [[245, 245, 245], 200], [[200, 30, 40], 150], [[30, 60, 200], 150]])
    expect(c).toHaveLength(2)
    expect(c.every((x) => x.s > 60)).toBe(true)
  })

  it.each([
    ["black", [0, 0, 0]],
    ["white", [255, 255, 255]],
  ] as const)("falls back to several greys for an all-%s cover", (_, rgb) => {
    const c = colors([[[rgb[0], rgb[1], rgb[2]], 1000]])
    expect(c.length).toBeGreaterThan(1)
    expect(c.every((x) => x.s === 0 && x.l >= 40 && x.l <= 80)).toBe(true)
  })

  it("returns nothing when the cover couldn't be read", () => {
    expect(albumColors([])).toEqual([])
  })
})
