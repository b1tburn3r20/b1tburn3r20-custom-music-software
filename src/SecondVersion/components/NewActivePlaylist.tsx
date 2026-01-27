import { ScrollArea } from "@/components/ui/scroll-area"
import { useAppStore } from "@/stores/useAppStore"
import { formatDuration } from "@/utils/textUtils"
import { Music } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { addRecentlyPlayed } from "@/components/helpers/utilities"
import { startNewQueue } from "@/utils/musicutils"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import type { Song } from "@/types/DirectoryTypes"
import PlaylistSongComponent from "./PlaylistSongComponent"
import PlaylistActionButtons from "../playlists/PlaylistActionButtons/PlaylistActionButtons"

const NewActivePlaylist = () => {
  const activePlaylist = useAppStore((f) => f.currentPlaylist)
  const [dominantColor, setDominantColor] = useState("147, 112, 219")
  const colorCache = useRef<Map<string, string>>(new Map())
  const rootMusicDir = useDirectoryStore((f) => f.rootDir)
  const setPaused = usePlayerStore((f) => f.setPaused)



  const handlePlay = (song: Song) => {
    setPaused(false)
    addRecentlyPlayed(song)
    startNewQueue(rootMusicDir, song.path)
  }

  const handlePause = () => {
    setPaused(true)
  }

  const handleResume = () => {
    setPaused(false)
  }


  const paused = usePlayerStore((f) => f.paused)
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  const fallbackColors = [
    "147, 112, 219",
    "100, 149, 237",
    "144, 238, 144",
    "240, 128, 128",
    "255, 182, 193",
    "255, 200, 124",
  ]

  useEffect(() => {
    const thumbnail = activePlaylist?.songs?.[0]?.metadata?.thumbnail
    const playlistId = activePlaylist?.id || activePlaylist?.name || ""

    if (thumbnail) {
      extractDominantColor(thumbnail as string)
    } else {
      const hash = playlistId.toString().split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
      const colorIndex = hash % fallbackColors.length
      setDominantColor(fallbackColors[colorIndex])
    }
  }, [activePlaylist])

  const extractDominantColor = (imageSrc: string) => {
    if (colorCache.current.has(imageSrc)) {
      setDominantColor(colorCache.current.get(imageSrc)!)
      return
    }

    const img = new Image()
    img.crossOrigin = "Anonymous"
    img.src = imageSrc

    img.onload = () => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return

      const size = 50
      canvas.width = size
      canvas.height = size
      ctx.drawImage(img, 0, 0, size, size)

      const imageData = ctx.getImageData(0, 0, size, size).data
      const colorMap = new Map()

      const step = 4 * 10
      for (let i = 0; i < imageData.length; i += step) {
        const r = imageData[i]
        const g = imageData[i + 1]
        const b = imageData[i + 2]
        const a = imageData[i + 3]

        if (a < 125 || (r > 250 && g > 250 && b > 250) || (r < 10 && g < 10 && b < 10))
          continue

        const packed = (r << 16) | (g << 8) | b
        colorMap.set(packed, (colorMap.get(packed) || 0) + 1)
      }

      let maxCount = 0
      let dominantPacked = 0x9370DB

      for (const [packed, count] of colorMap) {
        if (count > maxCount) {
          maxCount = count
          dominantPacked = packed
        }
      }

      const r = (dominantPacked >> 16) & 0xFF
      const g = (dominantPacked >> 8) & 0xFF
      const b = dominantPacked & 0xFF

      const dominantRGB = `${r}, ${g}, ${b}`
      colorCache.current.set(imageSrc, dominantRGB)
      setDominantColor(dominantRGB)
    }
  }

  const NoDirSelected = () => {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <Music className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">No playlist selected</p>
        <p className="text-sm">Select a folder to get started</p>
      </div>
    )
  }

  const songs = activePlaylist?.songs
  const fullDuration = songs?.reduce((acc, curr) => acc + curr.metadata.duration, 0)

  if (!activePlaylist?.name) {
    return <NoDirSelected />
  }

  return (
    <div className="flex flex-col h-full space-y-12">
      <div
        className="relative p-8 transition-colors duration-700 "
        style={{
          background: `linear-gradient(to bottom, rgb(${dominantColor}) 0%, rgba(${dominantColor}, 0.8) 40%, rgba(${dominantColor}, 0.4) 70%, transparent 100%)`,
        }}
      >
        <div className="flex items-end gap-6">
          <div className="relative w-48 h-48 rounded-lg shadow-2xl overflow-hidden">
            {songs && songs[0]?.metadata?.thumbnail ? (
              <img
                src={songs[0].metadata.thumbnail as string}
                alt="Playlist cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: `rgba(0, 0, 0, 0.3)` }}
              >
                <Music className="w-20 h-20 text-white" />
              </div>
            )}
          </div>
          <div className="flex-1 pb-2">
            <p className="text-sm font-semibold uppercase tracking-wider mb-2 text-white/90">
              Playlist
            </p>
            <h1 className="text-5xl font-bold mb-4 tracking-tight text-white">
              {activePlaylist.name}
            </h1>
            <div className="flex gap-2 items-center">

              <p className="text-sm text-white/80">{songs?.length || 0} songs</p>
              <p className="text-sm text-white/80">{formatDuration(fullDuration || 0)}</p>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-10.5">
          <PlaylistActionButtons songs={songs || []} />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-8 py-4">
          {songs?.map((song, index) => (
            <PlaylistSongComponent
              key={song.metadata.title}
              index={index}
              song={song}
              onPlay={handlePlay}
              onPause={handlePause}
              onResume={handleResume}
              isPlaying={currentlyPlaying?.metadata.title === song.metadata.title}
              isPaused={paused}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

export default NewActivePlaylist
