
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { useMusicStore } from "@/stores/useMusicStore"
import type { PlaylistType } from "@/types/AppTypes"
import type { Song } from "@/types/DirectoryTypes"
import { extendQueue } from "@/utils/musicutils"
import { Play, Trash2, Pause, Loader2, LucideUserCircle2, LucideSquaresUnite } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

interface MusicQueueItemProps {
  song: Song
  isPlaying: boolean
  onPlay: (data: Song) => void
  onPause: () => void
  onResume: () => void
  isPaused: boolean
  darker?: boolean
  index: number
  queue: Song[]
  currentlyPlaying: Song
  playingPlaylist?: PlaylistType
}

const MusicQueueItem = ({ index, song, isPlaying, onPlay, onPause, onResume, isPaused, darker, queue, currentlyPlaying, playingPlaylist }: MusicQueueItemProps) => {
  const removeSong = useMusicStore((f) => f.removeSong)
  const rootDir = useDirectoryStore((f) => f.rootDir)
  const [deleting, setDeleting] = useState(false)
  const handleClick = () => {
    if (deleting) {
      return
    }
    if (isPlaying) {
      if (isPaused) {
        onResume()
      } else {
        onPause()
      }
    } else {
      onPlay(song)
    }
  }


  const handleDelete = async () => {
    setDeleting(true);
    try {
      console.log("Heres the thin", song)
      await (window as any).electron.deleteSong(song.path);
      removeSong(song)
    } catch (err) {
    } finally {
      setDeleting(false);

    }
  };


  const showPauseIcon = isPlaying && !isPaused

  const shouldFetchMoreSongs = queue.length - (queue.indexOf(currentlyPlaying) + 1) < 3


  const shouldShowSeparator = !!(!playingPlaylist && index === 0) || (playingPlaylist && (song?.path === playingPlaylist?.songs[playingPlaylist?.songs.length - 1]?.path))
  useEffect(() => {
    if (shouldFetchMoreSongs && isPlaying) {
      const pathFlatmap = queue.flatMap((f) => f.path)
      extendQueue(rootDir, song.path, pathFlatmap)
    }
  }, [currentlyPlaying])




  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={handleClick}
            className={`group flex select-none items-center gap-3 py-2 px-3 rounded-lg  transition-all cursor-pointer active:scale-[0.98] touch-manipulation ${isPlaying ? "bg-muted/20" : ""}  ${darker ? "bg-black/80 hover:bg-muted/20" : "hover:bg-accent/50"}  `}
          >
            <div className="relative h-12 w-12 md:h-14 md:w-14 shrink-0 overflow-hidden rounded-md bg-muted">
              <img
                src={song.metadata.thumbnail as string}
                alt={song.metadata.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <p title={song?.metadata?.title} className={`text-sm md:text-base font-semibold line-clamp-1 ${isPlaying ? "text-primary" : ""}`}>
                {song.metadata.title}
              </p>
              <p className={`text-xs md:text-sm text-muted-foreground line-clamp-1 ${isPlaying ? "text-primary/70" : ""}`}>
                {song.metadata.artist || "Unknown Artist"} <span className="text-muted-foreground/50">•</span> <span className="text-muted-foreground/50">{song.metadata.year}</span>
              </p>
            </div>           <div>
              {deleting ? (
                <div><Loader2 className="animate-spin" /> </div>
              ) : (

                <Button
                  variant="ghost"
                  size="icon"
                  className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${isPlaying ? 'opacity-100' : ''} md:h-10 md:w-10 h-9 w-9`}
                >
                  {showPauseIcon ? (
                    <Pause className={`h-4 w-4 md:h-5 md:w-5 ${isPlaying ? 'fill-current' : ''}`} />
                  ) : (
                    <Play className={`h-4 w-4 md:h-5 md:w-5 ${isPlaying ? 'fill-current' : ''}`} />
                  )}
                </Button>
              )}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={handleDelete} className="flex items-center gap-3 py-3 cursor-pointer">
            <Trash2 className="h-4 w-4" />
            <span className="text-sm">Delete Song</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {shouldShowSeparator && (
        <div>
          <Separator className="my-2" />
        </div>
      )}
    </div>
  )
}

export default MusicQueueItem
