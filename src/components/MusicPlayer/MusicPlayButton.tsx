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
    const handleKeyDown = (e: any) => {
      if (e.code === "Space" || e.key === " ") {
        if (!document.activeElement) {
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
