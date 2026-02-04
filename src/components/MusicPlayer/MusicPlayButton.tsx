import { usePlayerStore } from "@/stores/usePlayerStore"
import { Pause, Play } from "lucide-react"
import { useEffect } from "react"

const MusicPlayButton = () => {
  const paused = usePlayerStore((f) => f.paused)
  const setPaused = usePlayerStore((f) => f.setPaused)
  const audioRef = usePlayerStore((f) => f.audioRef)

  const handleMusicClick = () => {
    if (audioRef) {
      if (paused) {
        setPaused(false)
        audioRef.play()
      } else {
        setPaused(true)
        audioRef.pause()
      }
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        const target = e.target as HTMLElement;
        const isTyping = target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable;

        if (!isTyping) {
          e.preventDefault()
          handleMusicClick()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [paused, audioRef])
  return (
    <button
      id="music-play-button"
      className="rounded-full flex justify-center items-center p-4 cursor-pointer hover:bg-secondary/50 hover:text-primary"
      onClick={() => handleMusicClick()}
    >
      {paused ? <Play /> : <Pause />}
    </button>
  )
}

export default MusicPlayButton
