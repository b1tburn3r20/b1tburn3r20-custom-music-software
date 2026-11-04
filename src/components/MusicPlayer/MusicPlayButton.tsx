import { IconButton } from "@/components/base/IconButton"
import { togglePlay } from "@/player/controls"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Pause, Play } from "lucide-react"

const MusicPlayButton = () => {
  const paused = usePlayerStore((s) => s.paused)
  return (
    <IconButton
      icon={paused ? Play : Pause}
      label={paused ? "Play (Space)" : "Pause (Space)"}
      size="md"
      onClick={togglePlay}
      className="size-10 bg-primary p-0 text-primary-foreground hover:scale-105 hover:bg-primary/90 hover:text-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      iconClassName="fill-current"
    />
  )
}
export default MusicPlayButton
