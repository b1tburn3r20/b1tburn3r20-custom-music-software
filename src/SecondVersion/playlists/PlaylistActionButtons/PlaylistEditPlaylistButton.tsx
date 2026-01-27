import { Button } from "@/components/ui/button"
import { Edit2 } from "lucide-react"



const PlaylistEditPlaylistButton = () => {

  return (
    <div>
      <Button className="rounded-full h-14 w-14" variant={"muted_primary"}>
        <Edit2 className="" />
      </Button>

    </div>
  )
}

export default PlaylistEditPlaylistButton
