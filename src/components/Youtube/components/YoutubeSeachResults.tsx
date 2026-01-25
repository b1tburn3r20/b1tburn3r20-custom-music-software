import { type YoutubeDetailsResult } from "@/types/YoutubeTypes"
import { useYoutubeStore } from "../useYoutubeStore"
import YoutubeVideoResult from "./YoutubeVideoResult"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { Loader2, Search, Youtube } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
const YoutubeSeachResults = () => {

  const results = useYoutubeStore((f) => f.results)
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
    <div className="h-full flex flex-col gap-2">
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
          <div className="h-[76vh] text-muted-foreground gap-4 flex flex-col items-center justify-center text-center bg-muted">
            <p className="text-xl">Search something to get started</p>
            <Youtube className="text-red-500 animate-pulse" size={120} />
          </div>

        )}



      </ScrollArea>

    </div>
  )
}

export default YoutubeSeachResults
