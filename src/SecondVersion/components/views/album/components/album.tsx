
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDuration } from "@/utils/textUtils"
import { Music } from "lucide-react"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { addRecentlyPlayed } from "@/components/helpers/utilities"
import { openArtist, startNewQueueFromArray } from "@/utils/musicutils"
import type { Song } from "@/types/DirectoryTypes"
import { useColorCacheStore } from "@/stores/useColorCacheStore"
import { useMusicStore } from "@/stores/useMusicStore"
import AlbumActionButtons from "./AlbumActionButtons"
import AlbumSongComponent from "./AlbumSongComponent"

const ActiveAlbum = () => {
  const setPaused = usePlayerStore((f) => f.setPaused)
  const paused = usePlayerStore((f) => f.paused)
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  const activeAlbum = useMusicStore((f) => f.activeAlbum)
  const thumbnail = activeAlbum?.album_thumbnail
  const dominantColor = useColorCacheStore((state) =>
    state.getColor(thumbnail as string | undefined, "guarp")
  )

  const handlePlay = (song: Song) => {
    const list = activeAlbum?.album_songs ?? []
    addRecentlyPlayed(song)
    startNewQueueFromArray(list, undefined, activeAlbum ?? undefined, Math.max(0, list.findIndex((s) => s.id === song.id)))
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
        <p className="text-lg font-medium">No album selected</p>
        <p className="text-sm">Select a album to get started</p>
      </div>
    )
  }
  const handleViewArtist = (artistName: string) => openArtist(artistName)



  const songs = activeAlbum?.album_songs
  const fullDuration = songs?.reduce((acc, curr) => acc + curr.metadata.duration, 0)

  if (!activeAlbum?.album_name) {
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
              Album
            </p>
            <h1 className="text-5xl font-bold mb-4 tracking-tight text-white">
              {activeAlbum.album_name}
            </h1>
            <div className="mb-2">
              <div className="flex gap-2 items-center">
                {activeAlbum?.album_artists?.length >= 5 ? "Various Artists" : (
                  <>
                    {activeAlbum?.album_artists?.map((artist, index) => <p className="hover:underline cursor-pointer" onClick={() => handleViewArtist(artist)}>{artist}{index + 1 < activeAlbum?.album_artists?.length && (<span>,</span>)}</p>)}
                  </>
                )}
              </div>
              <div className="text-muted-foreground flex gap-2 items-center">
                {activeAlbum?.album_release_date?.map((artist, index) => <p>{artist}{index + 1 < activeAlbum?.album_release_date?.length && (<span>,</span>)}</p>)}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <p className="text-sm text-white/80">{songs?.length || 0} songs</p>
              <p className="text-sm text-white/80">{formatDuration(fullDuration || 0)}</p>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-10.5">
          <AlbumActionButtons songs={songs || []} />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-8 py-4">
          {songs?.map((song, index) => (
            <AlbumSongComponent
              key={song.id}
              index={index}
              song={song}
              onPlay={handlePlay}
              onPause={handlePause}
              onResume={handleResume}
              isPlaying={currentlyPlaying?.id === song.id}
              isPaused={paused}
              album={activeAlbum}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

export default ActiveAlbum
