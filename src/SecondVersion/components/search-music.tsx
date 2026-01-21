import { Input } from "@/components/ui/input"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { useMusicStore } from "@/stores/useMusicStore"
import { Search } from "lucide-react"
import { useState } from "react"

const SearchMusic = () => {
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const setMusicResults = useMusicStore((f) => f.setMusicResults)
  const rootMusicDir = useDirectoryStore((f) => f.rootDir)



  const searchMusic = async (query?: string) => {
    if (!rootMusicDir) return
    setIsLoading(true)
    try {
      const result = await (window as any).electron.searchSongs({
        rootDir: rootMusicDir,
        query: query,
        forceRefresh: false
      })
      console.log("searched with", query)
      console.log("Heres res", result)
      if (result.success) {
        setMusicResults(result.songs)
        console.log(`Loaded ${result.songs.length} songs from cache`)
      }
    } catch (error) {
      console.error('Error loading songs:', error)
    } finally {
      setIsLoading(false)
    }
  }






  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      searchMusic(e.target.value)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchQuery(val)

    if (!val) {
      searchMusic()
    }
  }

  return (
    <div className="w-full">
      <div>
        <div className="relative w-full">
          <Search className="absolute text-muted-foreground left-2 top-1.5" />
          <Input
            className="pl-10 w-full"
            placeholder={isLoading ? "Loading..." : "Search music..."}
            value={searchQuery}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  )
}

export default SearchMusic
