// The thin bar along the top of the window while data comes in, like YouTube's.
import { useEffect, useState } from "react"
import { nextProgress, useTopProgress } from "@/stores/useTopProgress"

const TICK_MS = 200
const FINISH_MS = 250

export function TopProgress() {
  const busy = useTopProgress((s) => s.active > 0)
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (busy) {
      setVisible(true)
      setWidth((w) => Math.max(w, 12))
      const timer = setInterval(() => setWidth(nextProgress), TICK_MS)
      return () => clearInterval(timer)
    }
    // Run to the end, fade out, and only then go back to the start where nobody can see it.
    setWidth((w) => (w > 0 ? 100 : 0))
    const fade = setTimeout(() => setVisible(false), FINISH_MS)
    const reset = setTimeout(() => setWidth(0), FINISH_MS * 2)
    return () => {
      clearTimeout(fade)
      clearTimeout(reset)
    }
  }, [busy])

  return (
    <div role="progressbar" aria-label="Loading" aria-hidden={!busy} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(width)} className="pointer-events-none fixed inset-x-0 top-0 z-progress h-0.5">
      <div className="h-full bg-primary" style={{ width: `${width}%`, opacity: visible ? 1 : 0, transition: `width ${TICK_MS}ms ease-out, opacity ${FINISH_MS}ms ease-out` }} />
    </div>
  )
}
