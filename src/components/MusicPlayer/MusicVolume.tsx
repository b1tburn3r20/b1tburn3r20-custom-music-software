import { Slider } from "@/components/ui/slider"
import { setVolume } from "@/player/controls"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Volume, Volume1, Volume2, VolumeX } from "lucide-react"
import { useState } from "react"

function VolumeIcon({ volume }: { volume: number }) {
  if (volume < 1) return <VolumeX className="w-5 h-5" />
  if (volume < 20) return <Volume className="w-5 h-5" />
  if (volume < 70) return <Volume1 className="w-5 h-5" />
  return <Volume2 className="w-5 h-5" />
}

const MusicVolume = () => {
  const volume = usePlayerStore((s) => s.volume)
  const [hovered, setHovered] = useState(false)
  return (
    <div className="flex w-full max-w-48 items-center gap-3" onMouseOver={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <VolumeIcon volume={volume} />
      <Slider aria-label="Volume" value={[volume]} onValueChange={(v) => setVolume(v[0])} max={100} step={1} expand={hovered} className="w-full" />
    </div>
  )
}

export default MusicVolume
