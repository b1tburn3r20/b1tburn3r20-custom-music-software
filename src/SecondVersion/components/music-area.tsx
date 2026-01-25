import { useMusicStore } from "@/stores/useMusicStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import SongComponent from "./song-component"
import type { Song } from "@/types/DirectoryTypes"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { startNewQueue } from "@/utils/musicutils"




const MusicArea = () => {
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
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
  const setRootDir = useDirectoryStore((f) => f.setRootDir)
  const setSongCache = useMusicStore((f) => f.setSongCache)

  const LS_KEY = "recentlyPlayed"

  const setPath = (path: any) => {
    setRootDir(path);
    localStorage.setItem("lastRootDir", path);
  };

  const loadDataFromLocalStorage = () => {
    const lastRootDir = localStorage.getItem("lastRootDir");
    if (lastRootDir) {
      setPath(lastRootDir);
    }
  }
  const handlePlay = (song: Song) => {
    setPaused(false)
    setPlaying(song)
    addRecentlyPlayed(song)
    startNewQueue(rootMusicDir, song.path)
  }

  const handlePause = () => {
    setPaused(true)
  }

  const handleResume = () => {
    setPaused(false)
  }
  const searchMusic = async () => {
    if (!rootMusicDir || results?.length) return
    setIsLoading(true)
    try {
      const result = await (window as any).electron.searchSongs({
        rootDir: rootMusicDir,
        query: null,
        forceRefresh: false
      })

      if (result?.songs?.length) {
        setMusicResults(result.songs)
      }
    } catch (error) {
      console.error('Error loading songs:', error)
    } finally {
      setIsLoading(false)
    }
  }
  const getSongCache = async () => {
    if (!rootMusicDir) return
    setIsLoading(true)
    try {
      const result = await (window as any).electron.getSongCache({
        rootDir: rootMusicDir,
        forceRefresh: false
      })
      if (result?.songs.length) {
        setSongCache(result.songs)
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
    loadDataFromLocalStorage()
  }, [])

  useEffect(() => {
    searchMusic()
    getSongCache()
  }, [rootMusicDir])


  return (
    <div>
      <p className="font-bold text-3xl mb-4">Random Picks</p>
      {isLoading ? (
        <div className="h-full w-full flex justify-center items-center"><Loader2 className="animate-spin" /> </div>

      ) : (
        <>

          {displayedResults.length > 0 ? (
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


          ) : (
            <>
              <div>No songs saved...</div>
            </>


          )}
        </>
      )}
    </div>
  )
}

export default MusicArea
