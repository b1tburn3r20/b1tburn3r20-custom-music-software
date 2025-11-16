import YoutubeInstall from "../../YoutubeInstall"
import { useYoutubeStore } from "../useYoutubeStore"
import YoutubePlaylistContainer from "./YoutubePlaylistContainer"
import YoutubeSeachResults from "./YoutubeSeachResults"
import YoutubeTypeToggle from "./YoutubeTypeToggle"

const YoutubeSearchContainer = () => {
  const playlist = useYoutubeStore((f) => f.playlists)

  return (
    <div className="w-full h-full bg-black/50 flex flex-col p-4 overflow-hidden">
      <div className="flex gap-2 mb-4 shrink-0">
        <YoutubeInstall />
        <YoutubeTypeToggle />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {playlist ? (
          <YoutubePlaylistContainer />
        ) : (
          <YoutubeSeachResults />
        )}
      </div>
    </div>
  )
}

export default YoutubeSearchContainer
