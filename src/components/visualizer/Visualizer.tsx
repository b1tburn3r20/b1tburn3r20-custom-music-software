import { useEffect, useRef } from "react"
import { createFrameReader } from "@/player/analyser"
import { useColorCacheStore } from "@/stores/useColorCacheStore"
import { useUserStore } from "@/stores/useUserStore"
import { coverRect, createScene, type Hsl, type Palette, type SceneId } from "./scenes"
import { loadSwatches, rgbToHsl } from "./swatches"

/** "r g b" or "var(--art-fallback-N)" → HSL. */
function toHsl(color: string): Hsl {
  let rgb = color
  const v = /^var\((--[\w-]+)\)$/.exec(color)
  if (v) rgb = getComputedStyle(document.documentElement).getPropertyValue(v[1]).trim()
  const [r, g, b] = rgb.split(/\s+/).map(Number)
  if (![r, g, b].every(Number.isFinite)) return { h: 260, s: 70, l: 50 }
  const c = rgbToHsl(r, g, b)
  // Greyscale covers still get some color; very dull ones get a saturation floor.
  return { ...c, s: Math.max(55, c.s) }
}

/** Shortest-way hue blend so color changes between songs glide instead of jumping. */
function blendHue(a: number, b: number, t: number) {
  const d = ((b - a + 540) % 360) - 180
  return (a + d * t + 360) % 360
}

type Props = {
  scene: SceneId
  artwork: string | null | undefined
  colorKey: string
  active: boolean
  /** Called when the locked tempo changes (rounded bpm, or null while not locked). */
  onTempo?: (bpm: number | null) => void
}

/** Full-bleed, audio-reactive canvas. Only animates while `active` and the window is visible. */
export function Visualizer({ scene, artwork, colorKey, active, onTempo }: Props) {
  const tempoRef = useRef(onTempo)
  useEffect(() => {
    tempoRef.current = onTempo
  })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const color = useColorCacheStore((s) => s.getColor(artwork ?? undefined, colorKey))
  const target = useRef<Palette>({ ...toHsl(color), swatches: [] })
  useEffect(() => {
    target.current = { ...toHsl(color), swatches: target.current.swatches }
  }, [color])
  useEffect(() => {
    let live = true
    if (!artwork) target.current = { ...target.current, swatches: [] }
    else void loadSwatches(artwork).then((swatches) => live && (target.current = { ...target.current, swatches }))
    return () => {
      live = false
    }
  }, [artwork])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!active || !canvas) return
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) return
    const s = createScene(scene)
    const read = createFrameReader(() => useUserStore.getState().settings.visualizerOffsetMs || 0)
    const palette: Palette = { ...target.current }
    let raf = 0
    let bpm: number | null = null

    let sized = false
    const snapshot = document.createElement("canvas")
    const resize = () => {
      // Render at CSS pixels (no DPR scaling): soft edges suit the effects and keep feedback scenes cheap.
      const w = Math.max(1, Math.floor(canvas.clientWidth))
      const h = Math.max(1, Math.floor(canvas.clientHeight))
      if (sized && canvas.width === w && canvas.height === h) return
      // Changing the size wipes the canvas. Tunnel builds each frame from the last one, so
      // keep the picture, centered and filling the new shape, instead of starting it over.
      const keep = sized
      if (keep) {
        snapshot.width = canvas.width
        snapshot.height = canvas.height
        snapshot.getContext("2d")!.drawImage(canvas, 0, 0)
      }
      sized = true
      // Setting the size (even to the same value) clears the canvas, so a new scene starts clean.
      canvas.width = w
      canvas.height = h
      s.resize(w, h)
      if (keep) {
        const r = coverRect(snapshot.width, snapshot.height, w, h)
        ctx.drawImage(snapshot, r.x, r.y, r.w, r.h)
      }
    }
    resize()

    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (document.hidden) return
      // Here rather than in a ResizeObserver, which runs just before the screen updates:
      // the wiped canvas would be shown as a black flash, over and over during a resize.
      resize()
      const f = read()
      palette.h = blendHue(palette.h, target.current.h, 0.02)
      palette.s += (target.current.s - palette.s) * 0.02
      palette.l += (target.current.l - palette.l) * 0.02
      palette.swatches = target.current.swatches // scenes ease toward these themselves
      s.draw(ctx, f, palette)
      const b = f.bpm ? Math.round(f.bpm) : null
      if (b !== bpm) tempoRef.current?.((bpm = b))
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      tempoRef.current?.(null)
    }
  }, [active, scene])

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />
}
