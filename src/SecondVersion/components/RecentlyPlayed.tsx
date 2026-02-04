import { useMusicStore } from "@/stores/useMusicStore"
import { useEffect, useMemo } from "react"
import RecentlyPlayedSongComponent from "./RecentlyPlayedSongComponent"
import { usePlayerStore } from "@/stores/usePlayerStore"
import type { Song } from "@/types/DirectoryTypes"
import { startNewQueue } from "@/utils/musicutils"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import RandomQueueButton from "./RandomQueueButton"

const RecentlyPlayed = () => {
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  const recentlyPlayed = useMusicStore((f) => f.recentlyPlayed)
  const setRecentlyPlayed = useMusicStore((f) => f.setRecentlyPlayed)
  const rootMusicDir = useDirectoryStore((f) => f.rootDir)
  const paused = usePlayerStore((f) => f.paused)
  const setPaused = usePlayerStore((f) => f.setPaused)
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
    for (const song of recentlyPlayed) {
      const key = `${song.path}|||${song.name}`
      if (!seen.has(key) && unique.length < 11) {
        seen.add(key)
        unique.push(song)
      }
    }
    return unique
  }, [recentlyPlayed])

  const loadFromLocalStorage = () => {
    const val = localStorage.getItem(LS_KEY)
    if (val) {
      const par = JSON.parse(val)
      setRecentlyPlayed(par)
    }
  }

  const handlePlay = (song: Song) => {
    addRecentlyPlayed(song)
    setPaused(false)
    startNewQueue(song.path)
  }

  const addRecentlyPlayed = (song: Song) => {
    const filtered = recentlyPlayed.filter((s) => {
      return !(s.name === song.name && s.folderPath === song.folderPath)
    })
    const newRecPlayed = [song, ...filtered].slice(0, 20)
    setRecentlyPlayed(newRecPlayed)
    localStorage.setItem(LS_KEY, JSON.stringify(newRecPlayed))
  }

  useEffect(() => {
    loadFromLocalStorage()
  }, [])

  if (uniqueRecentSongs.length === 0) return null

  return (
    <div className="">
      <p className="font-bold text-3xl mb-4">Listen Again</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {uniqueRecentSongs.slice(0, 4).map((res) => {
          return (
            <div key={`${res.folderPath}|||${res.name}`}>
              <RecentlyPlayedSongComponent
                onPause={handlePause}
                onResume={handleResume}
                isPaused={paused}
                onPlay={handlePlay}
                song={res}
                isPlaying={currentlyPlaying?.metadata?.title === res?.metadata?.title && currentlyPlaying?.folderPath === res?.folderPath}
              />
            </div>
          )
        })}
        <div className="cursor-pointer aspect-square p-3">
          <RandomQueueButton />
        </div>
        {uniqueRecentSongs.slice(4, 9).map((res) => {
          return (
            <div key={`${res.folderPath}|||${res.name}`}>
              <RecentlyPlayedSongComponent
                onPause={handlePause}
                onResume={handleResume}
                isPaused={paused}
                onPlay={handlePlay}
                song={res}
                isPlaying={currentlyPlaying?.metadata?.title === res?.metadata?.title && currentlyPlaying?.folderPath === res?.folderPath}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default RecentlyPlayed
