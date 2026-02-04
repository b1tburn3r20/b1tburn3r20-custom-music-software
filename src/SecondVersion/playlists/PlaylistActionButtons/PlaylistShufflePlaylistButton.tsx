import { shuffleArray } from "@/components/helpers/utilities"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/stores/useAppStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { startNewQueueFromArray } from "@/utils/musicutils"
import { Shuffle } from "lucide-react"



const PlaylistShufflePlaylistButton = () => {
  const currentPlaylist = useAppStore((f) => f.currentPlaylist)
  const setPlayingPlaylist = usePlayerStore((f) => f.setPlayingPlaylist)


  const shufflePlaylist = () => {
    if (currentPlaylist?.songs) {
      const shuffled = shuffleArray(currentPlaylist?.songs)
      startNewQueueFromArray(shuffled, currentPlaylist)
      setPlayingPlaylist(currentPlaylist);
    }
  }


  return (
    <div>
      <Button onClick={() => shufflePlaylist()} className="rounded-full h-14 w-14">
        <Shuffle className="fill-current" />
      </Button>

    </div>
  )
}

export default PlaylistShufflePlaylistButton
