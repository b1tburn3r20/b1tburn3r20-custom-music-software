
import { Button } from "@/components/ui/button"
import { useMusicStore } from "@/stores/useMusicStore"
import { playShuffled } from "@/player/controls"
import { Shuffle } from "lucide-react"



const AlbumSuffleButton = () => {
  const currentAlbum = useMusicStore((f) => f.activeAlbum)

  const shufflePlaylist = () => {
    if (currentAlbum) playShuffled(currentAlbum.album_songs, { type: "album", id: currentAlbum.key, label: currentAlbum.album_name })
  }



  return (
    <div>
      <Button onClick={() => shufflePlaylist()} className="rounded-full h-14 w-14">
        <Shuffle className="fill-current" />
      </Button>

    </div>
  )
}

export default AlbumSuffleButton
