import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu"
import { useMusicStore, type CacheSongType } from "@/stores/useMusicStore"
import { Play, Trash2, Pause, Loader2 } from "lucide-react"
import { useState } from "react"
interface CacheResultProps {
  song: CacheSongType
  isPlaying: boolean
  onPlay: (data: CacheSongType) => void
  onPause: () => void
  onResume: () => void
  isPaused: boolean
  darker?: boolean
}



const CacheResult = ({ song, isPlaying, onPlay, onPause, onResume, isPaused, darker }: CacheResultProps) => {
  const removeSong = useMusicStore((f) => f.removeSong)
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
      await (window as any).electron.deleteSong(song.path);
      removeSong(song as any)
    } catch (err) {
    } finally {
      setDeleting(false);

    }
  };


  const showPauseIcon = isPlaying && !isPaused

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={handleClick}
          className={`group flex items-center gap-3 rounded-lg px-2 transition-all cursor-pointer active:scale-[0.98] touch-manipulation ${isPlaying ? "bg-muted/20" : ""}  ${darker ? "bg-black/80 hover:bg-muted/20" : "hover:bg-accent/50"}  `}
        >
          <div className="relative h-12 w-12 md:h-6 md:w-6 shrink-0 overflow-hidden rounded-[4px] bg-muted">
            <img
              src={song.thumbnail as string}
              alt={song.title}
              className="w-full shrink-0 h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <p className={`text-sm font-semibold truncate ${isPlaying ? "text-primary" : ""}`}>
              {song.title}
            </p>
            <p className={`text-xs text-muted-foreground truncate ${isPlaying ? "text-primary/70" : ""}`}>
              {song.artist || "Unknown Artist"}
            </p>
          </div>
          <div>
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
  )
}

export default CacheResult
