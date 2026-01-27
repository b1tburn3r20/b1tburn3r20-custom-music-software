
import { useMusicStore } from "@/stores/useMusicStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import SongComponent from "./song-component"
import type { Song } from "@/types/DirectoryTypes"
import { useState, useEffect } from "react"
import { startNewQueue } from "@/utils/musicutils"
import { useDirectoryStore } from "@/stores/useDirectoryStore"

const RecentlyDownloaded = () => {
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  const setPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const recentlyDownladed = useMusicStore((f) => f.recentlyDownloaded)
  const setRecentlyDownloaded = useMusicStore((f) => f.setRecentlyDownloaded)
  const recentlyPlayed = useMusicStore((f) => f.recentlyPlayed)
  const setRecentlyPlayed = useMusicStore((f) => f.setRecentlyPlayed)
  const setPaused = usePlayerStore((f) => f.setPaused)
  const paused = usePlayerStore((f) => f.paused)
  const rootMusicDir = useDirectoryStore((f) => f.rootDir)

  const [displayCount, setDisplayCount] = useState(8)
  const [isLargeScreen, setIsLargeScreen] = useState(false)

  const LSD_KEY = "userRecentlyDownloaded"
  const LSP_KEY = "recentlyPlayed"
  const addRecentlyPlayed = (song: Song) => {
    const filtered = recentlyPlayed.filter((s) => s.name !== song.name || s.folderPath !== song.folderPath)
    const newRecPlayed = [song, ...filtered]
    setRecentlyPlayed(newRecPlayed)
    localStorage.setItem(LSP_KEY, JSON.stringify(newRecPlayed))
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

  const loadFromLocalStorage = () => {

    const key = localStorage.getItem(LSD_KEY)
    if (key) {
      setRecentlyDownloaded(JSON.parse(key))
    }
  }

  useEffect(() => {
    loadFromLocalStorage()
  }, [])
  if (!recentlyDownladed?.length) {
    return null
  }
  return (
    <div>
      <p className="font-bold text-3xl mb-4">Recently Downloaded</p>
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


    </div>
  )
}

export default RecentlyDownloaded
