import { useMusicStore } from "@/stores/useMusicStore"
import { addRecentlyPlayed } from "@/components/helpers/utilities"
import { useMemo } from "react"
import RecentlyPlayedSongComponent from "./RecentlyPlayedSongComponent"
import { usePlayerStore } from "@/stores/usePlayerStore"
import type { Song } from "@/types/DirectoryTypes"
import { startNewQueue } from "@/utils/musicutils"
import RandomQueueButton from "./RandomQueueButton"

const RecentlyPlayed = () => {
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  const recentlyPlayed = useMusicStore((f) => f.recentlyPlayed)
  const paused = usePlayerStore((f) => f.paused)
  const setPaused = usePlayerStore((f) => f.setPaused)

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
      const key = song.id
      if (!seen.has(key) && unique.length < 11) {
        seen.add(key)
        unique.push(song)
      }
    }
    return unique
  }, [recentlyPlayed])


  const handlePlay = (song: Song) => {
    addRecentlyPlayed(song)
    setPaused(false)
    startNewQueue(song)
  }


  if (uniqueRecentSongs.length === 0) return null

  return (
    <div className="">
      <p className="font-bold text-3xl mb-4">Listen Again</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {uniqueRecentSongs.slice(0, 4).map((res) => {
          return (
            <div key={res.id}>
              <RecentlyPlayedSongComponent
                onPause={handlePause}
                onResume={handleResume}
                isPaused={paused}
                onPlay={handlePlay}
                song={res}
                isPlaying={currentlyPlaying?.id === res.id}
              />
            </div>
          )
        })}
        <div className="cursor-pointer aspect-square p-3">
          <RandomQueueButton />
        </div>
        {uniqueRecentSongs.slice(4, 9).map((res) => {
          return (
            <div key={res.id}>
              <RecentlyPlayedSongComponent
                onPause={handlePause}
                onResume={handleResume}
                isPaused={paused}
                onPlay={handlePlay}
                song={res}
                isPlaying={currentlyPlaying?.id === res.id}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default RecentlyPlayed
