import { usePlayerStore } from "@/stores/usePlayerStore"
import type { Song } from "@/types/DirectoryTypes"
import { FastForward } from "lucide-react"
interface FastForwardButtonProps {
  currentIndex: number
  children: Song[]
}

const FastForwardButton = ({ currentIndex, children }: FastForwardButtonProps) => {

  const setCurrentSong = usePlayerStore((f) => f.setCurrentlyPlaying)



  const isThereNextSong = children[currentIndex + 1]

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
