import { useMusicStore } from "@/stores/useMusicStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { FastForward } from "lucide-react"
interface FastForwardButtonProps {
  currentIndex: number
}

const FastForwardButton = ({ currentIndex }: FastForwardButtonProps) => {

  const setCurrentSong = usePlayerStore((f) => f.setCurrentlyPlaying)
  const queue = useMusicStore((f) => f.queue)


  const isThereNextSong = queue[currentIndex + 1]

  const handleNextSong = () => {
    const audioRef = usePlayerStore.getState().audioRef
    if (audioRef) {
      if (isThereNextSong) {
        setCurrentSong(isThereNextSong)
      }
    }
  }

  return (
    <button
      onClick={() => handleNextSong()}
      className="rounded-full flex justify-center items-center p-4 cursor-pointer hover:bg-secondary/50 hover:text-primary"
    >
      <FastForward />
    </button>

  )
}

export default FastForwardButton
