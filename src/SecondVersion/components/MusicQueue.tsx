import { usePlayerStore } from "@/stores/usePlayerStore"
import type { Song } from "@/types/DirectoryTypes"
import MusicQueueItem from "./music-queue-item"
import { useMusicStore } from "@/stores/useMusicStore"
import { ScrollArea } from "@/components/ui/scroll-area"

const MusicQueue = () => {
  const queue = useMusicStore((f) => f.queue)
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  const setPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const recentlyPlayed = useMusicStore((f) => f.recentlyPlayed)
  const setRecentlyPlayed = useMusicStore((f) => f.setRecentlyPlayed)
  const paused = usePlayerStore((f) => f.paused)
  const setPaused = usePlayerStore((f) => f.setPaused)
  const playingPlaylist = usePlayerStore((f) => f.playingPlaylist)
  const LS_KEY = "recentlyPlayed"
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

  const addRecentlyPlayed = (song: Song) => {
    const filtered = recentlyPlayed.filter((s) => {
      return !(s.name === song.name && s.folderPath === song.folderPath)
    })
    const newRecPlayed = [song, ...filtered].slice(0, 20)
    setRecentlyPlayed(newRecPlayed)
    localStorage.setItem(LS_KEY, JSON.stringify(newRecPlayed))
  }



  if (!queue) {
    return null
  }
  return (
    <div className="w-full flex justify-end">
      <div className="flex justify-end bg-black/40   max-w-md 2xl:max-w-lg h-full flex-col rounded-bl-lg">
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
          {queue.map((song, index) => <MusicQueueItem currentlyPlaying={currentlyPlaying} playingPlaylist={playingPlaylist} queue={queue} index={index} song={song} key={song.path} onPlay={handlePlay} onPause={handlePause} onResume={handleResume} isPaused={paused}

            isPlaying={currentlyPlaying?.metadata.title === song?.metadata.title && currentlyPlaying?.folderPath === song?.folderPath}

          />)}
        </ScrollArea>
      </div>
    </div>
  )
}

export default MusicQueue
