import { Button } from "@/components/ui/button"
import { useYoutubeStore } from "../useYoutubeStore"
import { ListMusic } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"


const YoutubeTypeToggle = () => {
  const playlist = useYoutubeStore((f) => f.playlists)
  const setPlaylist = useYoutubeStore((f) => f.setPlaylists)
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>

          <Button onClick={() => setPlaylist(!playlist)} variant={playlist ? "red" : "ghost"}>
            <ListMusic className={`${playlist ? "fill-current" : ""}`} />
          </Button>

        </TooltipTrigger>
        <TooltipContent>
          {playlist ? "Toggle Video Search" : "Toggle Playlist Search"}
        </TooltipContent>
      </Tooltip>

    </TooltipProvider>
  )
}

export default YoutubeTypeToggle
