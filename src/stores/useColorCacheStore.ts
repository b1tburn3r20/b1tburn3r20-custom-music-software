import { create } from "zustand"

const fallbackColors = [
  "147, 112, 219",
  "100, 149, 237",
  "144, 238, 144",
  "240, 128, 128",
  "255, 182, 193",
  "255, 200, 124",
]

type ColorCacheStore = {
  colorCache: Map<string, string>
  extractingImages: Set<string>
  getColor: (imageSrc: string | null | undefined, fallbackId: string) => string
  extractDominantColor: (imageSrc: string) => void
}

export const useColorCacheStore = create<ColorCacheStore>((set, get) => ({
  colorCache: new Map(),
  extractingImages: new Set(),

  getColor: (imageSrc: string | null | undefined, fallbackId: string) => {
    const { colorCache, extractDominantColor } = get()

    if (imageSrc) {
      if (colorCache.has(imageSrc)) {
        return colorCache.get(imageSrc)!
      }

      extractDominantColor(imageSrc)
      const hash = fallbackId.toString().split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
      const colorIndex = hash % fallbackColors.length
      return fallbackColors[colorIndex]
    }

    const hash = fallbackId.toString().split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const colorIndex = hash % fallbackColors.length
    return fallbackColors[colorIndex]
  },

  extractDominantColor: (imageSrc: string) => {
    const { colorCache, extractingImages } = get()

    if (colorCache.has(imageSrc) || extractingImages.has(imageSrc)) {
      return
    }

    set((state) => ({
      extractingImages: new Set(state.extractingImages).add(imageSrc)
    }))

    const img = new Image()
    img.crossOrigin = "Anonymous"
    img.src = imageSrc

    img.onload = () => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) {
        set((state) => {
          const newSet = new Set(state.extractingImages)
          newSet.delete(imageSrc)
          return { extractingImages: newSet }
        })
        return
      }

      const size = 50
      canvas.width = size
      canvas.height = size
      ctx.drawImage(img, 0, 0, size, size)

      const imageData = ctx.getImageData(0, 0, size, size).data
      const colorMap = new Map()

      const step = 4 * 10
      for (let i = 0; i < imageData.length; i += step) {
        const r = imageData[i]
        const g = imageData[i + 1]
        const b = imageData[i + 2]
        const a = imageData[i + 3]

        if (a < 125 || (r > 250 && g > 250 && b > 250) || (r < 10 && g < 10 && b < 10))
          continue

        const packed = (r << 16) | (g << 8) | b
        colorMap.set(packed, (colorMap.get(packed) || 0) + 1)
      }

      let maxCount = 0
      let dominantPacked = 0x9370db

      for (const [packed, count] of colorMap) {
        if (count > maxCount) {
          maxCount = count
          dominantPacked = packed
        }
      }

      const r = (dominantPacked >> 16) & 0xff
      const g = (dominantPacked >> 8) & 0xff
      const b = dominantPacked & 0xff

      const dominantRGB = `${r}, ${g}, ${b}`

      set((state) => {
        const newCache = new Map(state.colorCache)
        newCache.set(imageSrc, dominantRGB)
        const newSet = new Set(state.extractingImages)
        newSet.delete(imageSrc)
        return {
          colorCache: newCache,
          extractingImages: newSet
        }
      })
    }

    img.onerror = () => {
      set((state) => {
        const newSet = new Set(state.extractingImages)
        newSet.delete(imageSrc)
        return { extractingImages: newSet }
      })
    }
  },
}))
