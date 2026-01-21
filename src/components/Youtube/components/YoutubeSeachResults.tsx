import { type YoutubeDetailsResult } from "@/types/YoutubeTypes"
import { useYoutubeStore } from "../useYoutubeStore"
import YoutubeVideoResult from "./YoutubeVideoResult"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { Loader2, Search } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import YoutubeVideoURLSearch from "./YoutubeVideoURLSearch"
const YoutubeSeachResults = () => {

  const results = useYoutubeStore((f) => f.results)
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
    <div className="h-full flex flex-col gap-2">
      <YoutubeVideoURLSearch />
      <ScrollArea className="h-full rounded-3xl overflow-y-auto">
        {results.length > 0 ? (
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center flex-wrap gap-4">
              {results.map((item: YoutubeDetailsResult, index: number) => (
                <YoutubeVideoResult key={index} result={item} currentDir={currentDir} />
              ))}
            </div>
          </div>
        ) : (
          <div className="h-[80vh] text-muted-foreground gap-4 flex flex-col items-center justify-center text-center bg-accent/50">
            <p className="text-3xl">No Video Search</p>
            <p className="text-xl">Search something to get started</p>
            <Search className="animate-pulse" size={120} />
          </div>

        )}



      </ScrollArea>

    </div>
  )
}

export default YoutubeSeachResults
