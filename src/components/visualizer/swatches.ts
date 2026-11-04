// The main colors of a cover image, for visualizer scenes that paint with them.
import type { Hsl } from "./scenes"

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 }
}

/**
 * Up to `max` distinct main colors from RGBA pixel data, most prominent first.
 * Colorful pixels are grouped by hue (and a little by lightness) and outrank
 * greys, so a vivid accent isn't lost behind a large dull background, but a
 * black-and-white cover still yields its greys.
 */
export function pickSwatches(data: Uint8ClampedArray, max = 5): Hsl[] {
  type Bucket = { weight: number; n: number; r: number; g: number; b: number }
  const buckets = new Map<string, Bucket>()
  let total = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
    const c = rgbToHsl(r, g, b)
    const colorful = isColorful(c)
    const key = colorful ? `h${Math.floor(c.h / 24)}:${c.l < 40 ? 0 : c.l < 65 ? 1 : 2}` : `n${Math.floor(c.l / 34)}`
    const weight = colorful ? 1 + c.s / 100 : 0.6
    const bk = buckets.get(key) ?? { weight: 0, n: 0, r: 0, g: 0, b: 0 }
    bk.weight += weight
    bk.n++
    bk.r += r
    bk.g += g
    bk.b += b
    buckets.set(key, bk)
    total++
  }
  const ranked = [...buckets.values()].filter((b) => b.n >= total * 0.02).sort((a, b) => b.weight - a.weight)
  const out: Hsl[] = []
  for (const b of ranked) {
    const c = rgbToHsl(b.r / b.n, b.g / b.n, b.b / b.n)
    // Skip colors too close to one already picked.
    const near = out.some((o) => {
      const dh = Math.abs(((o.h - c.h + 540) % 360) - 180)
      const bothColorful = o.s > 22 && c.s > 22
      return bothColorful ? dh < 20 && Math.abs(o.l - c.l) < 18 : Math.abs(o.l - c.l) < 15 && Math.abs(o.s - c.s) < 20
    })
    if (!near) out.push(c)
    if (out.length >= max) break
  }
  return out
}

const isColorful = (c: Hsl) => c.s > 22 && c.l > 10 && c.l < 92

/** Shown for covers with no color at all; a black or white swatch alone wouldn't read as a pattern. */
const GREYS: Hsl[] = [45, 60, 75].map((l) => ({ h: 0, s: 0, l }))

/**
 * What a scene limited to the cover's colors should paint with: its real colors,
 * or greys if it's entirely black, white or grey. [] if the cover gave no swatches.
 */
export function albumColors(swatches: Hsl[]): Hsl[] {
  if (!swatches.length) return []
  const colorful = swatches.filter(isColorful)
  return colorful.length ? colorful : GREYS
}

const cache = new Map<string, Hsl[]>()

/** Loads the image (CORS-safe media:// URLs) and returns its main colors; [] if it can't be read. */
export function loadSwatches(src: string): Promise<Hsl[]> {
  const hit = cache.get(src)
  if (hit) return Promise.resolve(hit)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.decoding = "async"
    img.onload = () => {
      const size = 48
      const canvas = document.createElement("canvas")
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return resolve([])
      ctx.drawImage(img, 0, 0, size, size)
      try {
        const swatches = pickSwatches(ctx.getImageData(0, 0, size, size).data)
        if (cache.size > 200) cache.delete(cache.keys().next().value as string)
        cache.set(src, swatches)
        resolve(swatches)
      } catch {
        resolve([]) // tainted canvas
      }
    }
    img.onerror = () => resolve([])
    img.src = src
  })
}
