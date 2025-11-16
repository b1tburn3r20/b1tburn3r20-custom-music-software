import { usePlayerStore } from "@/stores/usePlayerStore"
import RewindButton from "./Controls/Rewind"
import FastForwardButton from "./Controls/FastForwardButton"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import MusicPlayButton from "./MusicPlayButton"


const MusicControls = () => {
  const currentSong = usePlayerStore((f) => f.currentlyPlaying)
  if (!currentSong) {
    return null
  }
  const currentDir = useDirectoryStore((f) => f.currentDir)
  const children = currentDir?.songs
  const currentIndex = children?.indexOf(currentSong)




  return (
    <div className="flex items-center gap-2">
      <RewindButton currentIndex={currentIndex || 0} children={children || []} />
      <MusicPlayButton />
      <FastForwardButton currentIndex={currentIndex || 0} children={children || []} />
    </div>
  )
}

export default MusicControls
