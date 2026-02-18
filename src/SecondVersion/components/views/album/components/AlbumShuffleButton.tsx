
import { shuffleArray } from "@/components/helpers/utilities"
import { Button } from "@/components/ui/button"
import { useMusicStore } from "@/stores/useMusicStore"
import { startNewQueueFromArray } from "@/utils/musicutils"
import { Shuffle } from "lucide-react"



const AlbumSuffleButton = () => {
  const currentAlbum = useMusicStore((f) => f.activeAlbum)
  const setPlayingAlbum = useMusicStore((f) => f.setPlayingAlbum)

  const shufflePlaylist = () => {
    if (currentAlbum?.album_songs) {
      const shuffled = shuffleArray(currentAlbum?.album_songs)
      startNewQueueFromArray(shuffled, undefined, currentAlbum)
      setPlayingAlbum(currentAlbum);
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

export default AlbumSuffleButton
