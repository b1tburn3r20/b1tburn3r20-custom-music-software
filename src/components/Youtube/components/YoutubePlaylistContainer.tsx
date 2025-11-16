import { useYoutubeStore } from "../useYoutubeStore"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { Loader2, Search } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import YoutubePlaylists from "./YoutubePlaylist"

const YoutubePlaylistContainer = () => {
  const results = useYoutubeStore((f) => f.youtubePlaylistResults)
  const currentDir = useDirectoryStore((f) => f.currentDir)
  const searching = useYoutubeStore((f) => f.searchingYoutube)

  if (searching) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg h-full flex flex-col justify-center items-center">
        <Loader2 className="text-primary animate-spin" size={120} />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full rounded-3xl">
      {results.length > 0 ? (
        <div className="p-4 rounded-lg bg-muted/50">
          <YoutubePlaylists playlists={results} currentDir={currentDir} />
        </div>
      ) : (
        <div className="h-full text-muted-foreground gap-4 flex flex-col items-center justify-center text-center bg-accent/50">
          <p className="text-3xl">No Playlist Search</p>
          <p className="text-xl">Search something to get started</p>
          <Search className="animate-pulse" size={120} />
        </div>
      )}
    </ScrollArea>
  )
}

export default YoutubePlaylistContainer
