import { Button } from "@/components/ui/button"
import { useAppStore } from "@/stores/useAppStore"
import { playShuffled } from "@/player/controls"
import { Shuffle } from "lucide-react"



const PlaylistShufflePlaylistButton = () => {
  const currentPlaylist = useAppStore((f) => f.currentPlaylist)


  const shufflePlaylist = () => {
    if (currentPlaylist) playShuffled(currentPlaylist.songs, { type: "playlist", id: currentPlaylist.id, label: currentPlaylist.name })
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
