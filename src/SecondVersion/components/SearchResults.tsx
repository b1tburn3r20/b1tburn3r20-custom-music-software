
import { useMusicStore } from "@/stores/useMusicStore"
import { useMemo } from "react"
import { usePlayerStore } from "@/stores/usePlayerStore"
import type { Song } from "@/types/DirectoryTypes"
import SongComponent from "./song-component"
import { useAppStore } from "@/stores/useAppStore"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { startNewQueue } from "@/utils/musicutils"
import { useDirectoryStore } from "@/stores/useDirectoryStore"

const SearchResults = () => {
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  const searchResults = useMusicStore((f) => f.musicResults)
  const setSearchResults = useMusicStore((f) => f.setMusicResults)
  const query = useAppStore((f) => f.query)
  const setQuery = useAppStore((f) => f.setQuery)
  const paused = usePlayerStore((f) => f.paused)
  const setPaused = usePlayerStore((f) => f.setPaused)
  const rootMusicDir = useDirectoryStore((f) => f.rootDir)
  const LS_KEY = "recentlyPlayed"
  const handlePause = () => {
    setPaused(true)
  }

  const handleResume = () => {
    setPaused(false)
  }


  const uniqueRecentSongs = useMemo(() => {
    const seen = new Set<string>()
    const unique: Song[] = []

    for (const song of searchResults) {
      const key = `${song.path}|||${song.name}`

      if (!seen.has(key) && unique.length < 8) {
        seen.add(key)
        unique.push(song)
      }
    }

    return unique
  }, [searchResults])

  const handlePlay = (song: Song) => {
    addRecentlyPlayed(song)
    setPaused(false)
    startNewQueue(rootMusicDir, song.path)
  }

  const addRecentlyPlayed = (song: Song) => {
    const filtered = searchResults.filter((s) => {
      return !(s.name === song.name && s.folderPath === song.folderPath)
    })
    const newRecPlayed = [song, ...filtered].slice(0, 20)
    setSearchResults(newRecPlayed)
    localStorage.setItem(LS_KEY, JSON.stringify(newRecPlayed))
  }


  if (uniqueRecentSongs.length === 0) return null

  return (
    <div id="sr-fr" className="">
      <div className="flex gap-5 items-center mb-4">
        <p className="font-bold text-3xl">{uniqueRecentSongs.length} results for: "{query}"</p>
        <Button className="scale-125" variant={"muted_primary"} onClick={() => {
          setQuery(null)
          setSearchResults([])
        }}>
          <X />
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-2 items-center">
        {uniqueRecentSongs.map((res) => (
          <SongComponent
            onPause={handlePause}
            onResume={handleResume}
            isPaused={paused}
            onPlay={handlePlay}
            song={res}
            isPlaying={currentlyPlaying?.metadata.title === res?.metadata.title && currentlyPlaying?.folderPath === res?.folderPath}
            key={`${res.folderPath}|||${res.name}`}
            darker
          />
        ))}
      </div>
    </div>
  )
}

export default SearchResults 
