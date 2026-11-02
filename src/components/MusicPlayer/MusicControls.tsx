import { usePlayerStore } from "@/stores/usePlayerStore"
import RewindButton from "./Controls/Rewind"
import FastForwardButton from "./Controls/FastForwardButton"
import MusicPlayButton from "./MusicPlayButton"
import LikeSongButton from "./Controls/like-song-button"
import ShuffleControls from "./Controls/ShuffleControls"

const MusicControls = () => {
  const currentSong = usePlayerStore((s) => s.currentlyPlaying)
  if (!currentSong) return null
  return (
    <div className="flex items-center gap-2">
      <ShuffleControls />
      <RewindButton />
      <MusicPlayButton />
      <FastForwardButton />
      <LikeSongButton song={currentSong} />
    </div>
  )
}

export default MusicControls
