import { ScrollArea } from "@/components/ui/scroll-area"
import { useAppStore } from "@/stores/useAppStore"
import { formatDuration } from "@/utils/textUtils"
import { Music } from "lucide-react"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { addRecentlyPlayed } from "@/components/helpers/utilities"
import { startNewQueue } from "@/utils/musicutils"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import type { Song } from "@/types/DirectoryTypes"
import PlaylistSongComponent from "./PlaylistSongComponent"
import PlaylistActionButtons from "../playlists/PlaylistActionButtons/PlaylistActionButtons"
import { useColorCacheStore } from "@/stores/useColorCacheStore"

const NewActivePlaylist = () => {
  const activePlaylist = useAppStore((f) => f.currentPlaylist)
  const rootMusicDir = useDirectoryStore((f) => f.rootDir)
  const setPaused = usePlayerStore((f) => f.setPaused)
  const paused = usePlayerStore((f) => f.paused)
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)

  const thumbnail = activePlaylist?.songs?.[0]?.metadata?.thumbnail
  const playlistId = activePlaylist?.id || activePlaylist?.name || ""
  const dominantColor = useColorCacheStore((state) =>
    state.getColor(thumbnail as string | undefined, playlistId)
  )

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
                <Music

                  style={{ color: `rgb(${dominantColor})` }}

                  className="w-20 h-20 text-white" />
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
