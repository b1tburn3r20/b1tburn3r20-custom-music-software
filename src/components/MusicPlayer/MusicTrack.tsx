import { Slider } from "@/components/ui/slider"
import { useEffect, useRef, useState } from "react"
import { useAppStore } from "@/stores/useAppStore"
import { usePlaybackClock } from "@/stores/usePlayerStore"
import { seek, seekBy } from "@/player/controls"
import { formatDuration } from "@/utils/textUtils"
import { nearSeekBar } from "@/lib/seekReach"

/** Seek bar along the top edge of the player. ←/→ seek 5 s (Shift: 15 s), Home/End jump to the ends. */
const MusicTrack = () => {
  const time = usePlaybackClock((s) => s.time)
  const duration = usePlaybackClock((s) => s.duration)
  const [near, setNear] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dragging, setDragging] = useState(false)
  const active = near || focused || dragging
  const ref = useRef<HTMLDivElement>(null)
  const idle = useAppStore((f) => f.idle)
  const progress = duration > 0 ? (time / duration) * 100 : 0
  // Grows when the cursor comes near, measured from anywhere on the page: an invisible hover strip
  // above the bar would block clicks on whatever is behind it.
  useEffect(() => {
    if (idle) {
      setNear(false)
      return
    }
    const onMove = (e: PointerEvent) => {
      const track = ref.current?.querySelector("[data-slot=slider-track]")
      if (!track) return
      const box = track.getBoundingClientRect()
      setNear(e.clientX >= box.left && e.clientX <= box.right && nearSeekBar(e.clientY, box.top, box.bottom))
    }
    const onOut = () => setNear(false)
    const onUp = () => setDragging(false)
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("blur", onOut)
    document.documentElement.addEventListener("mouseleave", onOut)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("blur", onOut)
      document.documentElement.removeEventListener("mouseleave", onOut)
    }
  }, [idle])
  const onKeyDown = (e: React.KeyboardEvent) => {
    // Per-step keyboard seeking on a 0.1 % scale would be uselessly small; seek in seconds instead.
    if (e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault()
      e.stopPropagation()
      seekBy((e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 15 : 5))
    }
  }
  return (
    <div
      ref={ref}
      className="relative z-player-track"
      onPointerDown={() => setDragging(true)} // stays grown while dragging, wherever the cursor goes
      // Only keyboard focus keeps it grown: a click focuses it too, and it should still shrink once the cursor leaves.
      onFocus={(e) => setFocused(e.target.matches(":focus-visible"))}
      onBlur={() => setFocused(false)}
    >
      <Slider
        aria-label="Seek"
        aria-valuetext={`${formatDuration(time)} of ${formatDuration(duration)}`}
        expand={active}
        value={[progress]}
        onValueChange={(value) => seek((value[0] / 100) * duration)}
        onKeyDown={onKeyDown}
        max={100}
        step={0.1}
        className="w-full rounded-none"
        hidden={idle}
      />
    </div>
  )
}

export default MusicTrack
