import { useMusicStore } from "@/stores/useMusicStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Rewind } from "lucide-react"


interface RewindButtonProps {
  currentIndex: number
}

const RewindButton = ({ currentIndex }: RewindButtonProps) => {
  const audioRef = usePlayerStore((f) => f.audioRef)
  const setCurrentlyPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const queue = useMusicStore((f) => f.queue)
  const handleRewind = () => {
    if (audioRef) {
      const currentTime = audioRef?.currentTime
      if (currentTime > 5) {
        // this resstarts the song
        audioRef.currentTime = 0
      } else {
        const previousSong = queue[currentIndex - 1]
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
