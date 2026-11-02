import { Slider } from "@/components/ui/slider"
import { useState } from "react"
import { useAppStore } from "@/stores/useAppStore"
import { usePlaybackClock } from "@/stores/usePlayerStore"
import { seek } from "@/player/controls"

const MusicTrack = () => {
  const time = usePlaybackClock((s) => s.time)
  const duration = usePlaybackClock((s) => s.duration)
  const [hovered, setHovered] = useState(false)
  const idle = useAppStore((f) => f.idle)
  const progress = duration > 0 ? (time / duration) * 100 : 0
  return (
    <div className="z-player-track" onMouseOver={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Slider
        aria-label="Seek"
        expand={hovered}
        value={[progress]}
        onValueChange={(value) => seek((value[0] / 100) * duration)}
        max={100}
        step={0.1}
        className="w-full rounded-none"
        hidden={idle}
      />
    </div>
  )
}

export default MusicTrack
