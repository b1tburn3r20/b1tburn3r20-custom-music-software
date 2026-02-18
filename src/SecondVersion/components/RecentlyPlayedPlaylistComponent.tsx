import LottieViewer from "@/components/helpers/lottie-viewer"
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu"
import { useAppStore } from "@/stores/useAppStore"
import { useColorCacheStore } from "@/stores/useColorCacheStore"
import { useMusicStore } from "@/stores/useMusicStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import type { PlaylistType } from "@/types/AppTypes"
import { formatDuration } from "@/utils/textUtils"
import { Dot, Music, Play, Trash2 } from "lucide-react"

interface RecentlyPlayedPlaylistComponentProps {
  playlist: PlaylistType
  isPlaying: boolean
  onPause: () => void
  onResume: () => void
  isPaused: boolean
}


const RecentlyPlayedPlaylistComponent = ({ playlist, isPlaying, onPause, onResume, isPaused }: RecentlyPlayedPlaylistComponentProps) => {
  const setPlaylistToDelete = useAppStore((f) => f.setPlaylistForDelete)
  const setPlayingPlaylist = usePlayerStore((f) => f.setPlayingPlaylist)
  const setQueue = useMusicStore((f) => f.setQueue)
  const startPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const setPaused = usePlayerStore((f) => f.setPaused)

  const thumbnail = playlist?.songs[0]?.metadata?.thumbnail
  const handleClick = () => {
    if (isPlaying) {
      if (isPaused) {
        onResume()
      } else {
        onPause()
      }
    } else {
      if (playlist?.songs?.length) {
        setQueue(playlist.songs)
        startPlaying(playlist.songs[0])
        setPaused(false)
        setPlayingPlaylist(playlist)


      }
    }
  }
  const dominantColor = useColorCacheStore((state) =>
    state.getColor(thumbnail as string | undefined, playlist?.id)
  );


  const fullDuration = playlist?.songs?.reduce((acc, curr) => acc + curr.metadata.duration, 0)

  const handleDelete = async () => {
    setPlaylistToDelete(playlist)
  };


  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={() => handleClick()}
          className="group relative select-none flex flex-col gap-2 p-3 rounded-xl hover:bg-accent/50 transition-all cursor-pointer active:scale-95"
        >
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
            <div className="h-full w-full transition-transform group-hover:scale-105">
              {playlist?.songs[0]?.metadata?.thumbnail ? (
                <div className="rounded-md relative h-full w-full shrink-0 transition-all group-hover:bg-white/20">
                  <img
                    className="h-full w-full object-cover rounded-md"
                    src={playlist?.songs[0]?.metadata?.thumbnail}
                    alt={`${playlist.name} playlist cover`}
                  />
                  {isPlaying ? (
                    <div className="absolute z-[4] inset-0 bg-black/20 m-1 rounded-lg opacity-50">
                      <LottieViewer />
                    </div>
                  ) : (
                    <div className="absolute z-[4] inset-0 bg-black/40 m-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="h-5 w-5 text-white fill-white" />
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="p-1 rounded-lg flex flex-col justify-center items-center h-full w-full transition-all group-hover:brightness-110"
                  style={{ backgroundColor: `rgba(${dominantColor}, 0.2)` }}
                >
                  <Music
                    className="h-10 w-10 rounded-lg p-2 transition-transform group-hover:scale-110"
                    style={{ color: `rgb(${dominantColor})` }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-0.5 min-w-0">
            <p className={`text-sm md:text-base font-semibold truncate ${isPlaying ? "text-primary" : ""}`}>
              {playlist?.name}
            </p>
            <p className={`text-xs md:text-sm text-muted-foreground flex gap-1 items-center truncate ${isPlaying ? "text-primary/70" : ""}`}>
              {playlist?.songs?.length} songs <Dot className="text-muted-foreground/70" />  <p className="text-sm text-muted-foreground/70">{formatDuration(fullDuration || 0)}</p>
            </p>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuItem className="flex items-center gap-3 py-3 cursor-pointer" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 text-red-500" />
          <span className="text-sm">
            Delete Playlist
          </span>
        </ContextMenuItem>

      </ContextMenuContent>
    </ContextMenu>
  )
}

export default RecentlyPlayedPlaylistComponent
