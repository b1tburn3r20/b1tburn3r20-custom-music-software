
import { ScrollArea } from "@/components/ui/scroll-area"
import { Music } from "lucide-react"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { addRecentlyPlayed } from "@/components/helpers/utilities"
import { startNewQueue } from "@/utils/musicutils"
import type { Song } from "@/types/DirectoryTypes"
import { useColorCacheStore } from "@/stores/useColorCacheStore"
import { useMusicStore } from "@/stores/useMusicStore"
import AlbumComponent from "./AlbumComponent"
import SongComponent from "@/SecondVersion/components/song-component"

const ActiveArtist = () => {
  const setPaused = usePlayerStore((f) => f.setPaused)
  const paused = usePlayerStore((f) => f.paused)
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  const activeArtist = useMusicStore((f) => f.activeArtist)
  const thumbnail = activeArtist?.artist_thumbnail
  const dominantColor = useColorCacheStore((state) =>
    state.getColor(thumbnail as string | undefined, "sguarp")
  )

  const handlePlay = (song: Song) => {
    setPaused(false)
    addRecentlyPlayed(song)
    startNewQueue(song.path)
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

  // const songs = activeArtist?.artist_thumbnail

  if (!activeArtist?.artist_name) {
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
            {activeArtist?.artist_thumbnail ? (
              <img
                src={activeArtist?.artist_thumbnail as string}
                alt="artist cover"
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
              Artist
            </p>
            <h1 className="text-5xl font-bold mb-4 tracking-tight text-white">
              {activeArtist?.artist_name}
            </h1>
            <div className="flex gap-2 items-center">
            </div>
          </div>
        </div>
        {/* <div className="absolute -bottom-10.5"> */}
        {/*   <AlbumActionButtons songs={activeArtist?.artist_songs} /> */}
        {/* </div> */}
      </div>
      {activeArtist?.artist_albums.length ? (

        <ScrollArea className="flex-1">
          <div className="px-8 py-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6">
            {activeArtist?.artist_albums?.map((album, index) => (
              <AlbumComponent isPlaying={false} isPaused={paused} onPause={handlePause} onResume={handleResume} album={album} key={index} />

            ))}
          </div>
        </ScrollArea>


      ) : ""}
      <ScrollArea className="flex-1">
        <div className="px-8 py-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4">
          {activeArtist?.artist_songs?.map((song, index) => (
            <SongComponent


              isPlaying={currentlyPlaying?.metadata.title === song.metadata.title}

              isPaused={paused} onPause={handlePause} onResume={handleResume} onPlay={handlePlay} song={song} key={index} />

          ))}
        </div>
      </ScrollArea>

    </div>
  )
}

export default ActiveArtist
