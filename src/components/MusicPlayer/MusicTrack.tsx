import { Slider } from "@/components/ui/slider"
import { useState } from "react"
import { useAppStore } from "@/stores/useAppStore"
import { usePlaybackClock } from "@/stores/usePlayerStore"
import { seek, seekBy } from "@/player/controls"
import { formatDuration } from "@/utils/textUtils"

/** Seek bar along the top edge of the player. ←/→ seek 5 s (Shift: 15 s), Home/End jump to the ends. */
const MusicTrack = () => {
  const time = usePlaybackClock((s) => s.time)
  const duration = usePlaybackClock((s) => s.duration)
  const [active, setActive] = useState(false)
  const idle = useAppStore((f) => f.idle)
  const progress = duration > 0 ? (time / duration) * 100 : 0
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
      className="relative z-player-track"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
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
