import { useEffect, useState } from "react"
import { Maximize, Minimize } from "lucide-react"
import { IconButton } from "@/components/base/IconButton"
import { call } from "@/lib/api"

/** Stays right however fullscreen changes: this button, F11, or the OS. */
export function FullscreenButton() {
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    call(window.api.window.isFullscreen()).then(setFullscreen, () => {})
    return window.api.window.onFullscreenChanged(setFullscreen)
  }, [])
  const label = fullscreen ? "Exit full screen (F11)" : "Full screen (F11)"
  return <IconButton icon={fullscreen ? Minimize : Maximize} label={label} size="md" className="bg-muted/60" onClick={() => void call(window.api.window.toggleFullscreen())} />
}
