import { playContext } from "@/player/controls"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/stores/useAppStore"
import type { Song } from "@/types/DirectoryTypes"
import { Play } from "lucide-react"



interface PlaylistStartPlaylistButtonProps {
  songs: Song[]
}

const PlaylistStartPlaylistButton = ({ songs }: PlaylistStartPlaylistButtonProps) => {
  const activePlaylist = useAppStore((f) => f.currentPlaylist)
  const handlePlay = () => {
    if (activePlaylist) playContext(songs, 0, { type: "playlist", id: activePlaylist.id, label: activePlaylist.name })
  }




  return (
    <div>
      <Button
        onClick={() => handlePlay()}
        className="rounded-full h-14 w-14">
        <Play className="fill-current" />
      </Button>

    </div>
  )
}

export default PlaylistStartPlaylistButton
