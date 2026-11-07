// Replaces the stock Windows title bar. Windows still draws the minimize, maximize and close
// buttons, which keeps snap layouts and resizing native, but they take their colors from the
// theme. The bar has no controls of its own: it's somewhere to drag the window from.
import { useEffect, useRef, useState } from "react"
import { call } from "@/lib/api"

/** Any CSS color as #rrggbb, which is all the native buttons accept. */
function toHex(color: string) {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`
}

export function TitleBar() {
  const ref = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    void call(window.api.window.isFullscreen()).then(setFullscreen).catch(() => {})
    return window.api.window.onFullscreenChanged(setFullscreen)
  }, [])

  // Follows anything that changes the theme, including the system switching between light and dark.
  useEffect(() => {
    const paint = () => {
      if (!ref.current) return
      const { backgroundColor, color } = getComputedStyle(ref.current)
      void call(window.api.window.setTitleBarColors(toHex(backgroundColor), toHex(color))).catch((e) => console.warn("[window] couldn't color the title bar:", e))
    }
    paint()
    const observer = new MutationObserver(paint)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] })
    return () => observer.disconnect()
  }, [fullscreen])

  if (!window.api.window.hasTitleBar || fullscreen) return null
  return <div ref={ref} data-region="title-bar" aria-hidden className="h-8 shrink-0 bg-background-dark text-foreground [-webkit-app-region:drag]" />
}
