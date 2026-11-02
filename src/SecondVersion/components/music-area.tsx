import { useMusicStore } from "@/stores/useMusicStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import SongComponent from "./song-component"
import type { Song } from "@/types/DirectoryTypes"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { addRecentlyPlayed } from "@/components/helpers/utilities"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { startNewQueue } from "@/utils/musicutils"
import { useColorCacheStore } from "@/stores/useColorCacheStore"
import SongSkeleton from "./SongSkeleton"




const MusicArea = () => {
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  const setPaused = usePlayerStore((f) => f.setPaused)
  const paused = usePlayerStore((f) => f.paused)
  const results = useMusicStore((f) => f.randomMusic)
  const isLoading = !useLibraryStore((s) => s.loaded)
  const [displayCount, setDisplayCount] = useState(8)
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const getColor = useColorCacheStore((f) => f.getColor)
  const handlePlay = (song: Song) => {
    addRecentlyPlayed(song)
    startNewQueue(song)
  }

  const handlePause = () => {
    setPaused(true)
  }

  const handleResume = () => {
    setPaused(false)
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

  return (
    <div>
      <p className="font-bold text-3xl mb-4">Random Picks</p>
      {isLoading ? (
        <div className="h-full w-full flex justify-center items-center"><Loader2 className="animate-spin" /> </div>

      ) : (
        <>

          {displayedResults.length > 0 ? (
            <>
              <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                {displayedResults.map((res) => (
                  <SongComponent
                    key={res.id}
                    song={res}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onResume={handleResume}
                    isPlaying={currentlyPlaying?.id === res.id}
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
              <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                {[...Array(displayCount)].map((_, i) => {
                  const dominantColor = getColor(
                    i.toString(),
                    (i + 1).toString()
                  )
                  return (

                    <div key={i}>
                      <SongSkeleton dominantColor={dominantColor} />
                    </div>
                  )



                })}

              </div>

            </>


          )}
        </>
      )}
    </div>
  )
}

export default MusicArea
