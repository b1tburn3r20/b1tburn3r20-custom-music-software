import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu"
import type { Song } from "@/types/DirectoryTypes"
import { Play, Trash2, Pause } from "lucide-react"

interface SongComponentProps {
  song: Song
  isPlaying: boolean
  onPlay: (data: Song) => void
  onPause: () => void
  onResume: () => void
  isPaused: boolean
}

const SongComponent = ({ song, isPlaying, onPlay, onPause, onResume, isPaused }: SongComponentProps) => {
  const handleClick = () => {
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

  const showPauseIcon = isPlaying && !isPaused

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={handleClick}
          className={`group flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-accent/50 transition-all cursor-pointer active:scale-[0.98] touch-manipulation ${isPlaying ? "bg-muted/20" : ""}`}
        >
          <div className="relative h-12 w-12 md:h-14 md:w-14 shrink-0 overflow-hidden rounded-md bg-muted">
            <img
              src={song.metadata.thumbnail as string}
              alt={song.metadata.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <p className={`text-sm md:text-base font-semibold truncate ${isPlaying ? "text-primary" : ""}`}>
              {song.metadata.title}
            </p>
            <p className={`text-xs md:text-sm text-muted-foreground truncate ${isPlaying ? "text-primary/70" : ""}`}>
              {song.metadata.artist || "Unknown Artist"}
            </p>
          </div>
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
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem className="flex items-center gap-3 py-3 cursor-pointer">
          <Trash2 className="h-4 w-4" />
          <span className="text-sm">Remove from playlist</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export default SongComponent
