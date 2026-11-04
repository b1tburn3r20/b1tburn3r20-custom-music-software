import { Slider } from "@/components/ui/slider"
import { IconButton } from "@/components/base/IconButton"
import { setVolume, toggleMute } from "@/player/controls"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Volume, Volume1, Volume2, VolumeX } from "lucide-react"
import { useState } from "react"

const iconFor = (volume: number) => (volume < 1 ? VolumeX : volume < 20 ? Volume : volume < 70 ? Volume1 : Volume2)

const MusicVolume = () => {
  const volume = usePlayerStore((s) => s.volume)
  const [active, setActive] = useState(false)
  return (
    <div
      className="flex w-full max-w-36 items-center gap-2"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
    >
      <IconButton icon={iconFor(volume)} size="sm" label={volume < 1 ? "Unmute (M)" : "Mute (M)"} aria-pressed={volume < 1} onClick={toggleMute} />
      <Slider
        aria-label="Volume"
        aria-valuetext={`${Math.round(volume)}%`}
        value={[volume]}
        onValueChange={(v) => setVolume(v[0])}
        max={100}
        step={5}
        expand={active}
        className="w-full"
      />
    </div>
  )
}

export default MusicVolume
