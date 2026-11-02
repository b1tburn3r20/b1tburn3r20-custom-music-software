
import { playContext } from "@/player/controls"
import { Button } from "@/components/ui/button"
import { useMusicStore } from "@/stores/useMusicStore"
import type { Song } from "@/types/DirectoryTypes"
import { Play } from "lucide-react"



interface AlbumPlayButtonProps {
  songs: Song[]
}

const AlbumPlayButton = ({ songs }: AlbumPlayButtonProps) => {
  const activeAlbum = useMusicStore((f) => f.activeAlbum)
  const handlePlay = () => {
    playContext(songs, 0, activeAlbum ? { type: "album", id: activeAlbum.key, label: activeAlbum.album_name } : null)
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
