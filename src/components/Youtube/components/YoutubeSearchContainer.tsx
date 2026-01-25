import YoutubeInstall from "../../YoutubeInstall"
import { useYoutubeStore } from "../useYoutubeStore"
import YoutubePlaylistContainer from "./YoutubePlaylistContainer"
import YoutubePlaylistFilter from "./YoutubePlaylistFilter"
import YoutubeSeachResults from "./YoutubeSeachResults"
import YoutubeSearchFilters from "./YoutubeSearchFilters"
import YoutubeVideoURLSearch from "./YoutubeVideoURLSearch"

const YoutubeSearchContainer = () => {
  const playlist = useYoutubeStore((f) => f.playlists)

  return (
    <div className="w-full h-full bg-black/50 overflow-hidden p-4">

      <div className="container mx-auto flex flex-col">
        <div className="w-full flex flex-row-reverse justify-between items-center flex-wrap">
          <div className="flex  gap-2 mb-4 shrink-0">
            <YoutubeSearchFilters />
            <YoutubePlaylistFilter />
            <YoutubeInstall />
          </div>

          <div className="flex gap-2 mb-4 shrink-0">
            <YoutubeVideoURLSearch />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {playlist ? (
            <YoutubePlaylistContainer />
          ) : (
            <YoutubeSeachResults />
          )}
        </div>
      </div>
    </div>
  )
}

export default YoutubeSearchContainer
