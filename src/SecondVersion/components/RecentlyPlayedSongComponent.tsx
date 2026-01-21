import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu"
import type { Song } from "@/types/DirectoryTypes"
import { Play, Trash2 } from "lucide-react"

interface SongComponentProps {
  song: Song
  isPlaying: boolean
  onPlay: (data: Song) => void
}

const RecentlyPlayedSongComponent = ({ song, isPlaying, onPlay }: SongComponentProps) => {
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
              <div className={`rounded-full bg-primary p-3 transform transition-transform group-hover:scale-110 ${isPlaying ? 'animate-pulse' : ''}`}>
                <Play className="h-6 w-6 text-primary-foreground fill-current" />
              </div>
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
        <ContextMenuItem className="flex items-center gap-3 py-3 cursor-pointer">
          <Trash2 className="h-4 w-4" />
          <span className="text-sm">
            Remove from history
          </span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export default RecentlyPlayedSongComponent
