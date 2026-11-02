
import LottieViewer from "@/components/helpers/lottie-viewer"
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu"
import { useAppStore } from "@/stores/useAppStore"
import { useColorCacheStore } from "@/stores/useColorCacheStore"
import { useMusicStore } from "@/stores/useMusicStore"
import { Dot, Music, Play } from "lucide-react"

interface AlbumComponentProps {
  album: any
  isPlaying: boolean
  onPause: () => void
  onResume: () => void
  isPaused: boolean
}


const LowAlbumProps = ({ album, isPlaying, onPause, onResume, isPaused }: AlbumComponentProps) => {
  const setView = useAppStore((f) => f.setView)
  const setActiveAlbum = useMusicStore((f) => f.setActiveAlbum)

  const handleAlbumClick = () => {
    setActiveAlbum(album)
    setView("album")
  }



  const thumbnail = album?.album_thumbnail
  const dominantColor = useColorCacheStore((state) =>
    state.getColor(thumbnail as string | undefined, album?.album_name)
  );


  const fullDuration = album?.album_songs?.reduce((acc, curr) => acc + curr.metadata.duration, 0)



  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={handleAlbumClick}
          className="group relative select-none flex flex-col gap-2 p-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer"
        >
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
            <div className="h-full w-full transition-transform group-hover:scale-105">
              {album?.thumbnail ? (
                <div className="rounded-md relative h-full w-full shrink-0 transition-all group-hover:bg-white/20">
                  <img
                    className="h-full w-full object-cover rounded-md"
                    src={album?.thumbnail}
                    alt={`${album.album_name} album cover`}
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
              {album?.album_name}
            </p>
            <p className={`text-xs md:text-sm text-muted-foreground flex gap-1 items-center truncate ${isPlaying ? "text-primary/70" : ""}`}>
              {album?.song_count} songs <Dot className="text-muted-foreground/70" />  <p className="text-sm text-muted-foreground/70">{album?.album_release_date}</p>
            </p>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem> Play Album</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export default LowAlbumProps 
