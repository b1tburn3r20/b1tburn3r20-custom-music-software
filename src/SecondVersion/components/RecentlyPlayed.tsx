import { useMusicStore } from "@/stores/useMusicStore"
import { useCallback, useEffect, useMemo } from "react"
import RecentlyPlayedSongComponent from "./RecentlyPlayedSongComponent"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import type { Song } from "@/types/DirectoryTypes"

const RecentlyPlayed = () => {
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  const setCurrentDir = useDirectoryStore((f) => f.setCurrentDir)
  const currentDir = useDirectoryStore((f) => f.currentDir)
  const setPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const recentlyPlayed = useMusicStore((f) => f.recentlyPlayed)
  const setRecentlyPlayed = useMusicStore((f) => f.setRecentlyPlayed)
  const setPaused = usePlayerStore((f) => f.setPaused)
  const LS_KEY = "recentlyPlayed"

  const uniqueRecentSongs = useMemo(() => {
    const seen = new Set<string>()
    const unique: Song[] = []

    for (const song of recentlyPlayed) {
      const key = `${song.path}|||${song.name}`

      if (!seen.has(key) && unique.length < 8) {
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
    fetchPlaylistContents(song)
  }

  const addRecentlyPlayed = (song: Song) => {
    const filtered = recentlyPlayed.filter((s) => {
      return !(s.name === song.name && s.folderPath === song.folderPath)
    })
    const newRecPlayed = [song, ...filtered].slice(0, 20)
    setRecentlyPlayed(newRecPlayed)
    localStorage.setItem(LS_KEY, JSON.stringify(newRecPlayed))
  }
  const fetchPlaylistContents = useCallback(async (song: Song) => {
    const folderPath = song.folderPath || song.path.substring(0, song.path.lastIndexOf('/'))
    if (currentDir?.path === folderPath) {
      const foundSong = currentDir?.songs.find((s) => s.name === song.name)
      if (foundSong) {
        setPlaying(foundSong)
        setPaused(false)
        addRecentlyPlayed(foundSong)
      }
      return
    }

    try {
      const playlistContents = await (window as any).electron.readFolderDetails(folderPath);
      setCurrentDir(playlistContents);
      const foundSong = playlistContents.songs.find((s: any) => s.name === song.name)
      if (foundSong) {
        setPlaying(foundSong)
        addRecentlyPlayed(foundSong)
      }
    } catch (err) {
      console.error('Error reading folder:', err);
    }
  }, [setCurrentDir, currentDir, recentlyPlayed]);

  useEffect(() => {
    loadFromLocalStorage()
  }, [])

  if (uniqueRecentSongs.length === 0) return null

  return (
    <div className="">
      <p className="font-bold text-3xl mb-4">Listen Again</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-2 items-center">
        {uniqueRecentSongs.map((res) => (
          <RecentlyPlayedSongComponent
            onPlay={handlePlay}
            song={res}
            isPlaying={currentlyPlaying?.metadata.title === res?.metadata.title && currentlyPlaying?.folderPath === res?.folderPath}
            key={`${res.folderPath}|||${res.name}`}
          />
        ))}
      </div>
    </div>
  )
}

export default RecentlyPlayed
