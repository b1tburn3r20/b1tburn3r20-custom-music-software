
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Slider } from "@/components/ui/slider"
import { useState } from "react"
import { useAppStore } from "@/stores/useAppStore"


const MusicTrack = () => {
  const progress = usePlayerStore((f) => f.musicProgress)
  const seek = usePlayerStore((f) => f.seek)
  const [hovered, setHovered] = useState(false)
  const idle = useAppStore((f) => f.idle)
  return (
    <div className="z-[9]" onMouseOver={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Slider
        expand={hovered}
        value={[progress]}
        onValueChange={(value) => seek(value[0])}
        max={100}
        step={1}
        className="w-full rounded-none"
        hidden={idle}
      />

    </div>
  )
}

export default MusicTrack
