import { type FileItem } from "@/stores/useDirectoryStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Rewind } from "lucide-react"


interface RewindButtonProps {
  currentIndex: number
  children: FileItem[]
}

const RewindButton = ({ currentIndex, children }: RewindButtonProps) => {
  const audioRef = usePlayerStore((f) => f.audioRef)
  const setCurrentlyPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)

  const handleRewind = () => {
    if (audioRef) {
      const currentTime = audioRef?.currentTime
      if (currentTime > 5) {
        // this resstarts the song
        audioRef.currentTime = 0
      } else {
        const previousSong = children[currentIndex - 1]
        if (previousSong) {
          setCurrentlyPlaying(previousSong)
        } else {
          audioRef.currentTime = 0
        }
      }
    }
  }





  return (
    <button
      onClick={() => handleRewind()}
      className="rounded-full flex justify-center items-center p-4 cursor-pointer hover:bg-secondary/50 hover:text-primary"
    >
      <Rewind />
    </button >

  )
}

export default RewindButton 
