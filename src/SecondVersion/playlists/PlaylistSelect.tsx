import { Music, Check } from "lucide-react"
import type { PlaylistType } from "@/types/AppTypes"
import { useColorCacheStore } from "@/stores/useColorCacheStore"
import { cn } from "@/lib/utils"

interface PlaylistSelectItemProps {
  playlist: PlaylistType
  isSelected: boolean
  onToggle: () => void
}

const PlaylistSelectItem = ({ playlist, isSelected, onToggle }: PlaylistSelectItemProps) => {
  const thumbnail = playlist?.songs?.[0]?.metadata?.thumbnail
  const playlistId = playlist?.id || playlist?.name || ""
  const dominantColor = useColorCacheStore((state) =>
    state.getColor(thumbnail as string | undefined, playlistId)
  )

  const songCount = playlist?.songs?.length || 0

  return (
    <div
      onClick={onToggle}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
        "hover:bg-accent/50",
        isSelected && "bg-accent/30 ring-2 ring-primary/50"
      )}
    >
      <div
        className={cn(
          "h-5 w-5 rounded border-2 flex items-center justify-center transition-all",
          isSelected
            ? "bg-primary border-primary"
            : "border-muted-foreground/50"
        )}
      >
        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
      </div>

      <div className="h-12 w-12 shrink-0">
        {thumbnail ? (
          <div className="bg-white/10 p-1 rounded-md h-full w-full">
            <img
              className="h-full w-full object-cover rounded-md"
              src={thumbnail}
              alt={`${playlist.name} cover`}
            />
          </div>
        ) : (
          <div
            className="p-1 rounded-lg flex items-center justify-center h-full w-full"
            style={{ backgroundColor: `rgba(${dominantColor}, 0.2)` }}
          >
            <Music
              className="h-8 w-8 p-1"
              style={{ color: `rgb(${dominantColor})` }}
            />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{playlist.name}</p>
        <p className="text-sm text-muted-foreground">
          {songCount} {songCount === 1 ? 'song' : 'songs'}
        </p>
      </div>
    </div>
  )
}

export default PlaylistSelectItem
