import { useYoutubeStore } from "../useYoutubeStore"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { Loader2, Search, Youtube } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import YoutubePlaylists from "./YoutubePlaylist"

const YoutubePlaylistContainer = () => {
  const results = useYoutubeStore((f) => f.youtubePlaylistResults)
  const currentDir = useDirectoryStore((f) => f.rootDir)
  const searching = useYoutubeStore((f) => f.searchingYoutube)

  if (searching) {
    return (
      <div className="h-[76vh] rounded-3xl text-muted-foreground gap-4 flex flex-col items-center justify-center text-center bg-muted">
        <Loader2 className="text-red-500 animate-pulse animate-spin" size={120} />
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
        <div className="h-[76vh] text-muted-foreground gap-4 flex flex-col items-center justify-center text-center bg-muted">
          <p className="text-xl">Search playlists to get started</p>
          <Youtube className="text-red-500 animate-pulse" size={120} />
        </div>

      )}
    </ScrollArea>
  )
}

export default YoutubePlaylistContainer
