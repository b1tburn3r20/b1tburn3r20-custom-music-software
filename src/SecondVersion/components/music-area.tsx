import { useMusicStore } from "@/stores/useMusicStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import SongComponent from "./song-component"
import type { Song } from "@/types/DirectoryTypes"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { useCallback, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

const MusicArea = () => {
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  const setCurrentDir = useDirectoryStore((f) => f.setCurrentDir)
  const currentDir = useDirectoryStore((f) => f.currentDir)
  const setPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const recentlyPlayed = useMusicStore((f) => f.recentlyPlayed)
  const setRecentlyPlayed = useMusicStore((f) => f.setRecentlyPlayed)
  const setPaused = usePlayerStore((f) => f.setPaused)
  const paused = usePlayerStore((f) => f.paused)
  const [isLoading, setIsLoading] = useState(false)
  const setMusicResults = useMusicStore((f) => f.setRandomMusic)
  const results = useMusicStore((f) => f.randomMusic)
  const rootMusicDir = useDirectoryStore((f) => f.rootDir)


  const [displayCount, setDisplayCount] = useState(8)
  const [isLargeScreen, setIsLargeScreen] = useState(false)

  const LS_KEY = "recentlyPlayed"

  const handlePlay = (song: Song) => {
    setPaused(false)
    fetchPlaylistContents(song)
  }

  const handlePause = () => {
    setPaused(true)
  }

  const handleResume = () => {
    setPaused(false)
  }
  const searchMusic = async (query?: string) => {
    if (!rootMusicDir) return
    setIsLoading(true)
    try {
      const result = await (window as any).electron.searchSongs({
        rootDir: rootMusicDir,
        query: query,
        forceRefresh: false
      })
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


  const addRecentlyPlayed = (song: Song) => {
    const filtered = recentlyPlayed.filter((s) => s.name !== song.name || s.folderPath !== song.folderPath)
    const newRecPlayed = [song, ...filtered]
    setRecentlyPlayed(newRecPlayed)
    localStorage.setItem(LS_KEY, JSON.stringify(newRecPlayed))
  }

  const fetchPlaylistContents = useCallback(
    async (song: Song) => {
      try {
        let playlistContents = currentDir
        if (currentDir?.path !== song.folderPath) {
          playlistContents = await (window as any).electron.readFolderDetails(song.folderPath)
          setCurrentDir(playlistContents)
        }
        const foundSong = playlistContents?.songs.find((s) => s.name === song.name)
        if (foundSong) {
          setPlaying(foundSong)
          addRecentlyPlayed(song)
          console.log("adding this song", song)
        }
      } catch (err) {
        console.error("Error reading folder:", err)
      }
    },
    [currentDir, setCurrentDir, setPlaying, recentlyPlayed]
  )

  const displayedResults = results.slice(0, displayCount)
  const hasMore = results.length > displayCount

  const loadMore = () => {
    setDisplayCount(prev => prev + 16)
  }

  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024)
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  useEffect(() => {
    setDisplayCount(isLargeScreen ? 16 : 8)
  }, [isLargeScreen])



  useEffect(() => {
    searchMusic()
  }, [rootMusicDir, setMusicResults])


  return (
    <div>
      <p className="font-bold text-3xl mb-4">Random Picks</p>
      {isLoading ? (
        <div className="h-full w-full flex justify-center items-center"><Loader2 className="animate-spin" /> </div>

      ) : (
        <>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 p-3 md:p-4">
            {displayedResults.map((res) => (
              <SongComponent
                key={res.metadata.title}
                song={res}
                onPlay={handlePlay}
                onPause={handlePause}
                onResume={handleResume}
                isPlaying={currentlyPlaying?.metadata.title === res.metadata.title}
                isPaused={paused}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pb-6">
              <Button
                onClick={loadMore}
                variant={"ghost"}
                className="bg-muted/10 w-full text-muted-foreground"
              >
                Load More
              </Button>
            </div>
          )}

        </>

      )}
    </div>
  )
}

export default MusicArea
