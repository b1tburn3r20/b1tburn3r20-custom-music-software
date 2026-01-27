import { Button } from "@/components/ui/button"
import { ListPlus } from "lucide-react"



const PlaylistAddSongsButton = () => {

  return (
    <div>
      <Button className="rounded-full h-14 w-14">
        <ListPlus className="fill-current" />
      </Button>

    </div>
  )
}

export default PlaylistAddSongsButton
