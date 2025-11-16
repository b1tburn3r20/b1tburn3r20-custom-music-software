import { Switch } from "@/components/ui/switch"
import { useYoutubeStore } from "../useYoutubeStore"


const YoutubeTypeToggle = () => {
  const playlist = useYoutubeStore((f) => f.playlists)
  const setPlaylist = useYoutubeStore((f) => f.setPlaylists)
  return (
    <div className="flex p-2 px-4 bg-muted/30 rounded-xl items-center justify-center">
      <Switch className="cursor-pointer scale-150" onCheckedChange={setPlaylist} checked={playlist} />
    </div>
  )
}

export default YoutubeTypeToggle
