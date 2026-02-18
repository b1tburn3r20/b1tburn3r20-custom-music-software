import { useMusicStore } from "@/stores/useMusicStore"
import { useEffect } from "react"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { addToRecentlyPlayedPlaylists, startNewQueue } from "@/utils/musicutils"
import RandomPlaylistButton from "./RandomPlaylistButton"
import type { PlaylistType } from "@/types/AppTypes"
import RecentlyPlayedPlaylistComponent from "./RecentlyPlayedPlaylistComponent"

const RecentlyPlayedPlaylists = () => {
  const recentlyPlayedPlaylists = useMusicStore((f) => f.recentlyPlayedPlaylists)
  const setRecetnlyPlayedPlaylists = useMusicStore((f) => f.setRecentlyPlayedPlaylists)
  const playingPlaylist = usePlayerStore((f) => f.playingPlaylist)
  const paused = usePlayerStore((f) => f.paused)
  const setPaused = usePlayerStore((f) => f.setPaused)
  const LS_KEY = "userRecentlyPlayedPlaylists"

  const handlePause = () => {
    setPaused(true)
  }

  const handleResume = () => {
    setPaused(false)
  }

  const loadFromLocalStorage = () => {
    const val = localStorage.getItem(LS_KEY)
    if (val) {
      const par = JSON.parse(val)
      setRecetnlyPlayedPlaylists(par)
    }
  }

  const addRecentlyPlayed = (playlist: PlaylistType) => {
    addToRecentlyPlayedPlaylists(playlist?.id)
  }

  useEffect(() => {
    loadFromLocalStorage()
  }, [])

  if (recentlyPlayedPlaylists.length === 0) return null

  return (
    <div className="">
      <p className="font-bold text-3xl mb-4">Recently Played Playlists</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {recentlyPlayedPlaylists.slice(0, 4).map((res) => {
          return (
            <div key={`${res.id}|||${res.name}`}>
              <RecentlyPlayedPlaylistComponent
                onPause={handlePause}
                onResume={handleResume}
                isPaused={paused}
                playlist={res}
                isPlaying={playingPlaylist?.id === res.id && !paused}
              />
            </div>
          )
        })}
        <div className="cursor-pointer aspect-square p-3">
          <RandomPlaylistButton />
        </div>
        {recentlyPlayedPlaylists.slice(4, 9).map((res) => {
          return (
            <div key={`${res.id}|||${res.name}`}>
              <RecentlyPlayedPlaylistComponent
                onPause={handlePause}
                onResume={handleResume}
                isPaused={paused}
                playlist={res}
                isPlaying={playingPlaylist?.id === res.id && !paused}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default RecentlyPlayedPlaylists
