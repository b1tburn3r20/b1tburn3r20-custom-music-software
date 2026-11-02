
import { useMusicStore } from "@/stores/useMusicStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import SongComponent from "./song-component"
import type { Song } from "@/types/DirectoryTypes"
import { useState, useEffect } from "react"
import { startNewQueue } from "@/utils/musicutils"
import { addRecentlyPlayed } from "@/components/helpers/utilities"
import { useColorCacheStore } from "@/stores/useColorCacheStore"
import SongSkeleton from "./SongSkeleton"

const RecentlyDownloaded = () => {
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  const recentlyDownladed = useMusicStore((f) => f.recentlyDownloaded)
  const setPaused = usePlayerStore((f) => f.setPaused)
  const paused = usePlayerStore((f) => f.paused)

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


  const displayedResults = recentlyDownladed.slice(0, displayCount)

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

  if (!recentlyDownladed?.length) {
    return (
      <div>
        <p className="font-bold text-3xl mb-4">No Downloads Yet</p>
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


      </div>



    )
  }
  return (
    <div>
      <p className="font-bold text-3xl mb-4">Recently Downloaded</p>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 p-3 md:p-4">
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


    </div>
  )
}

export default RecentlyDownloaded
