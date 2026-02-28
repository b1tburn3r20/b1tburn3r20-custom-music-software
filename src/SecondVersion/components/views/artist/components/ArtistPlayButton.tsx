
import { addRecentlyPlayed } from "@/components/helpers/utilities"
import { Button } from "@/components/ui/button"
import { useMusicStore } from "@/stores/useMusicStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import type { Song } from "@/types/DirectoryTypes"
import { Play } from "lucide-react"



interface AlbumPlayButtonProps {
  songs: Song[]
}

const AlbumPlayButton = ({ songs }: AlbumPlayButtonProps) => {
  const setQueue = useMusicStore((f) => f.setQueue)
  const activeAlbum = useMusicStore((f) => f.activeAlbum)
  const setPlayingAlbum = useMusicStore((f) => f.setPlayingAlbum)
  const setCurrentlyPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const handlePlay = () => {
    setPlayingAlbum(activeAlbum)
    setQueue(songs)
    setCurrentlyPlaying(songs[0])
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

export default AlbumPlayButton 
