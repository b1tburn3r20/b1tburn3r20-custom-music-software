import { usePlayerStore } from "@/stores/usePlayerStore"
import type { Song } from "@/types/DirectoryTypes"
import MusicQueueItem from "./music-queue-item"
import { useMusicStore } from "@/stores/useMusicStore"
import { ScrollArea } from "@/components/ui/scroll-area"
import { addRecentlyPlayed } from "@/components/helpers/utilities"
import { extendQueue } from "@/utils/musicutils"
import { useEffect } from "react"

const MusicQueue = () => {
  const queue = useMusicStore((f) => f.queue)
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  const setPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const paused = usePlayerStore((f) => f.paused)
  const setPaused = usePlayerStore((f) => f.setPaused)
  const playingPlaylist = usePlayerStore((f) => f.playingPlaylist)
  const handlePause = () => {
    setPaused(true)
  }

  const handleResume = () => {
    setPaused(false)
  }


  const handlePlay = (song: Song) => {
    addRecentlyPlayed(song)
    setPlaying(song)
    setPaused(false)

  }






  const playingAlbum = useMusicStore((f) => f.playingAlbum)
  // Radio: only extend an ad-hoc queue, never a playlist or album that's playing.
  useEffect(() => {
    if (!currentlyPlaying || playingPlaylist || playingAlbum) return
    const idx = queue.findIndex((s) => s.id === currentlyPlaying.id)
    if (idx !== -1 && queue.length - (idx + 1) < 3) extendQueue(currentlyPlaying)
  }, [currentlyPlaying, playingPlaylist, playingAlbum, queue])

  if (!queue) {
    return null
  }
  return (
    <div className="w-full flex justify-end">
      <div className="flex justify-end bg-black/60 backdrop-blur-lg  max-w-md 2xl:max-w-lg h-full flex-col rounded-bl-lg">
        <div className="select-none text-xl flex gap-1 items-center font-bold p-4 pb-0 text-muted-foreground ">
          <span className="truncate">
            <>
              {playingPlaylist ? (
                <span>
                  {playingPlaylist?.name}
                </span>

              ) : (
                <span>

                  "{queue[0]?.metadata.title}"
                </span>
              )}
            </>
          </span>
          <span>
            {playingPlaylist ? "Playlist" : "Queue"}
          </span>
        </div>
        <ScrollArea className="px-4 pt-4  h-[85vh] min-h-0">
          {queue.map((song, index) => <MusicQueueItem currentlyPlaying={currentlyPlaying} playingPlaylist={playingPlaylist} queue={queue} index={index} song={song} key={`${song.id}-${index}`} onPlay={handlePlay} onPause={handlePause} onResume={handleResume} isPaused={paused}

            isPlaying={currentlyPlaying?.id === song.id}

          />)}
        </ScrollArea>
      </div>
    </div>
  )
}

export default MusicQueue
