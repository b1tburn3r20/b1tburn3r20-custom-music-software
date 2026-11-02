import { IconButton } from "@/components/base/IconButton"
import { togglePlay } from "@/player/controls"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Pause, Play } from "lucide-react"

const MusicPlayButton = () => {
  const paused = usePlayerStore((s) => s.paused)
  return <IconButton icon={paused ? Play : Pause} label={paused ? "Play" : "Pause"} onClick={togglePlay} className="bg-foreground text-background hover:bg-foreground/90 hover:text-background" />
}
export default MusicPlayButton
