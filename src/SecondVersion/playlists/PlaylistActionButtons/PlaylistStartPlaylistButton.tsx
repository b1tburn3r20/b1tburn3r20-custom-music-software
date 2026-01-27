import { addRecentlyPlayed } from "@/components/helpers/utilities"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/stores/useAppStore"
import { useMusicStore } from "@/stores/useMusicStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import type { Song } from "@/types/DirectoryTypes"
import { Play } from "lucide-react"



interface PlaylistStartPlaylistButtonProps {
  songs: Song[]
}

const PlaylistStartPlaylistButton = ({ songs }: PlaylistStartPlaylistButtonProps) => {
  const setQueue = useMusicStore((f) => f.setQueue)
  const startPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const setPlaingPlaylist = usePlayerStore((f) => f.setPlayingPlaylist)
  const activePlaylist = useAppStore((f) => f.currentPlaylist)
  const handlePlay = () => {
    setPlaingPlaylist(activePlaylist)
    setQueue(songs)
    startPlaying(songs[0])
    addRecentlyPlayed(songs[0])
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
