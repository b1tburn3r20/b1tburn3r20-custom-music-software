import { usePlayerStore } from "@/stores/usePlayerStore"
import RewindButton from "./Controls/Rewind"
import FastForwardButton from "./Controls/FastForwardButton"
import MusicPlayButton from "./MusicPlayButton"
import { useMusicStore } from "@/stores/useMusicStore"


const MusicControls = () => {
  const currentSong = usePlayerStore((f) => f.currentlyPlaying)
  const queue = useMusicStore((f) => f.queue)
  if (!currentSong) {
    return null
  }
  const currentIndex = queue?.indexOf(currentSong)




  return (
    <div className="flex items-center gap-2">
      <RewindButton currentIndex={currentIndex || 0} />
      <MusicPlayButton />
      <FastForwardButton currentIndex={currentIndex || 0} />
    </div>
  )
}

export default MusicControls
