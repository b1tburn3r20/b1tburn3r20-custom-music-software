

import { shuffleArray } from "@/components/helpers/utilities"
import { Button } from "@/components/ui/button"
import type { Song } from "@/types/DirectoryTypes"
import { startNewQueueFromArray } from "@/utils/musicutils"
import { Shuffle } from "lucide-react"



const ArtistShuffleButton = ({ songs }: { songs: Song[] }) => {
  const shufflePlaylist = () => {
    if (songs?.length) {
      const shuffled = shuffleArray(songs)
      startNewQueueFromArray(shuffled, undefined)
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

export default ArtistShuffleButton
