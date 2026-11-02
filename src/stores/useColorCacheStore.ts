import { create } from "zustand"

/**
 * Dominant color of album art, as an "r g b" triplet usable in
 * rgb(var(--art-rgb) / alpha). While a cover hasn't been analysed (or has no
 * image) the value is a theme variable (var(--art-fallback-N)), so fallbacks
 * follow the active theme instead of being hardcoded.
 */
const FALLBACKS = 6
const fallbackFor = (key: string) => {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return `var(--art-fallback-${(h % FALLBACKS) + 1})`
}

const MAX_ENTRIES = 2000

type ColorCacheStore = {
  colorCache: Map<string, string>
  getColor: (imageSrc: string | null | undefined, fallbackId: string) => string
}

const extracting = new Set<string>()

export const useColorCacheStore = create<ColorCacheStore>((set, get) => {
  const extract = (src: string) => {
    if (extracting.has(src) || get().colorCache.has(src)) return
    extracting.add(src)
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.decoding = "async"
    img.src = src
    img.onload = () => {
      extracting.delete(src)
      const size = 50
      const canvas = document.createElement("canvas")
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(img, 0, 0, size, size)
      let data: Uint8ClampedArray
      try {
        data = ctx.getImageData(0, 0, size, size).data
      } catch {
        return // tainted canvas: keep the fallback
      }
      const counts = new Map<number, number>()
      for (let i = 0; i < data.length; i += 40) {
        const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
        if (a < 125 || (r > 250 && g > 250 && b > 250) || (r < 10 && g < 10 && b < 10)) continue
        // quantize so near-identical shades count together
        const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      let best = -1
      let bestN = 0
      for (const [k, n] of counts) if (n > bestN) [best, bestN] = [k, n]
      if (best < 0) return
      const rgb = `${((best >> 10) & 31) << 3} ${((best >> 5) & 31) << 3} ${(best & 31) << 3}`
      set((s) => {
        const cache = new Map(s.colorCache)
        if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string)
        cache.set(src, rgb)
        return { colorCache: cache }
      })
    }
    img.onerror = () => extracting.delete(src)
  }

  return {
    colorCache: new Map(),
    getColor: (imageSrc, fallbackId) => {
      if (imageSrc) {
        const hit = get().colorCache.get(imageSrc)
        if (hit) return hit
        queueMicrotask(() => extract(imageSrc))
      }
      return fallbackFor(fallbackId)
    },
  }
})
