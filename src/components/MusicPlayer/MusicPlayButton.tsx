import { togglePlay } from "@/player/controls"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Pause, Play } from "lucide-react"

const MusicPlayButton = () => {
  const paused = usePlayerStore((s) => s.paused)
  return (
    <button
      aria-label={paused ? "Play" : "Pause"}
      className="rounded-full flex justify-center items-center p-4 cursor-pointer hover:bg-secondary/50 hover:text-primary"
      onClick={togglePlay}
    >
      {paused ? <Play /> : <Pause />}
    </button>
  )
}

export default MusicPlayButton
