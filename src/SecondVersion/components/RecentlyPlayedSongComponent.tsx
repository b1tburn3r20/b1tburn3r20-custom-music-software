import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu"
import { useMusicStore } from "@/stores/useMusicStore"
import type { Song } from "@/types/DirectoryTypes"
import { Pause, Play, Trash2 } from "lucide-react"
import { useState } from "react"

interface SongComponentProps {
  song: Song
  isPlaying: boolean
  onPlay: (data: Song) => void
  onPause: () => void
  onResume: () => void
  isPaused: boolean
}


const RecentlyPlayedSongComponent = ({ song, isPlaying, onPlay, onPause, onResume, isPaused }: SongComponentProps) => {
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
      console.log("Heres the thin", song)
      await (window as any).electron.deleteSong(song.path);
      removeSong(song)
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
          onClick={() => onPlay(song)}
          className="group relative flex flex-col gap-2 p-3 rounded-xl hover:bg-accent/50 transition-all cursor-pointer active:scale-95"
        >
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
            <img
              src={song.metadata.thumbnail as string}
              alt={song.metadata.title}
              className="w-full h-full object-cover"
            />
            <div className={`absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center ${isPlaying ? 'opacity-100' : ''}`}>
              {showPauseIcon ? (
                <Pause className={`h-4 w-4 md:h-15 md:w-15 ${isPlaying ? 'fill-current' : ''}`} />
              ) : (
                <Play className={`h-4 w-4 md:h-15 md:w-15 ${isPlaying ? 'fill-current' : ''}`} />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-0.5 min-w-0">
            <p className={`text-sm md:text-base font-semibold truncate ${isPlaying ? "text-primary" : ""}`}>
              {song.metadata.title}
            </p>
            <p className={`text-xs md:text-sm text-muted-foreground truncate ${isPlaying ? "text-primary/70" : ""}`}>
              {song.metadata.artist || "Unknown Artist"}
            </p>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuItem className="flex items-center gap-3 py-3 cursor-pointer" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 text-red-500" />
          <span className="text-sm">
            Delete Song
          </span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export default RecentlyPlayedSongComponent
