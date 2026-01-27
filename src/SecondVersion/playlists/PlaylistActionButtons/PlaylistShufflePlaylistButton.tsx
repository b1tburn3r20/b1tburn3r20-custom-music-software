import { Button } from "@/components/ui/button"
import { Shuffle } from "lucide-react"



const PlaylistShufflePlaylistButton = () => {

  return (
    <div>
      <Button className="rounded-full h-14 w-14">
        <Shuffle className="fill-current" />
      </Button>

    </div>
  )
}

export default PlaylistShufflePlaylistButton
