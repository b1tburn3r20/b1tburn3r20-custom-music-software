
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Slider } from "@/components/ui/slider"

const MusicTrack = () => {
  const progress = usePlayerStore((f) => f.musicProgress)
  const seek = usePlayerStore((f) => f.seek)
  return (
    <div className="z-[9]">
      <Slider
        value={[progress]}
        onValueChange={(value) => seek(value[0])}
        max={100}
        step={1}
        className="w-full rounded-none"
      />

    </div>
  )
}

export default MusicTrack
