import LottieViewer from "@/components/helpers/lottie-viewer"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"
import { useAppStore } from "@/stores/useAppStore"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { useMusicStore } from "@/stores/useMusicStore"
import type { Song } from "@/types/DirectoryTypes"
import { Play, Trash2, Pause, Loader2, ListPlus, } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface SongComponentProps {
  song: Song
  isPlaying: boolean
  onPlay: (data: Song) => void
  onPause: () => void
  onResume: () => void
  isPaused: boolean
  darker?: boolean
}

const SongComponent = ({ song, isPlaying, onPlay, onPause, onResume, isPaused, darker }: SongComponentProps) => {
  const removeSong = useMusicStore((f) => f.removeSong)
  const setPlaylistUpdateData = useMusicStore((f) => f.setPlaylistUpdateData)
  const setIsPlaylistModalOpen = useMusicStore((f) => f.setIsPlaylistModalOpen)
  const setView = useAppStore((f) => f.setView)
  const rootDir = useDirectoryStore((f) => f.rootDir)
  const [hovered, setHovered] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const setActiveAlbum = useMusicStore((f) => f.setActiveAlbum)
  const setActiveArtist = useMusicStore((f) => f.setActiveArtist)

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
      removeSong(song)
    } catch (err) {
      console.error('Error deleting song:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleSetPlaylistAdd = () => {
    setPlaylistUpdateData(song)
    setTimeout(() => {
      setIsPlaylistModalOpen(true)
    }, 150)
  }
  const handleAlbumClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const result = await (window as any).electron.getAlbum({
        rootDir,
        path: song.path
      });

      if (result.success) {
        setView("album")
        setActiveAlbum(result)
      } else {
      }
    } catch (err) {
      console.error('error', err);
    }
  }

  const handleViewArtist = async (e: React.MouseEvent, artist: string) => {
    e.stopPropagation();
    try {
      const result = await (window as any).electron.getArtistByName({
        rootDir,
        artistName: artist,
      });
      if (result.success) {
        setView("artist")
        setActiveArtist(result)
      } else {
        toast.error("idk how did this")


      }
    } catch (err) {
      console.error("heres the error", err)
    }
  }

  const showPauseIcon = isPlaying && !isPaused

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onMouseLeave={() => setHovered(false)}
          onMouseOver={() => setHovered(true)}
          onClick={handleClick}
          className={`group flex items-center gap-3 py-2 px-3 rounded-lg  transition-all cursor-pointer active:scale-[0.98] touch-manipulation ${isPlaying ? "bg-muted/20" : ""}  ${darker ? "bg-black/80 hover:bg-muted/20" : "hover:bg-accent/50"}  `}
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

            <div className={`flex gap-1 items-center text-xs md:text-sm text-muted-foreground truncate  ${isPlaying ? "text-primary/70" : ""}`}>

              {song?.metadata.artist?.split(",").map((artist, index) => <p className="hover:underline cursor-pointer" onClick={(e) => handleViewArtist(e, artist)}>{artist}{index + 1 < song?.metadata?.artist?.split(",")?.length && (<span>,</span>)}</p>)}

            </div>



            {song?.metadata?.album && song?.metadata?.album !== "Unknown Album" ? (
              <p

                onClick={handleAlbumClick}
                className={`  hover:underline cursor-pointer text-xs md:text-sm text-muted-foreground/60 truncate ${isPlaying ? "text-primary/70" : ""}`}>
                <span
                >
                  {song?.metadata?.album}
                </span>
                <span> - </span>
                <span>{song.metadata.year}</span>
              </p>
            ) : ""}
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
                  <>
                    {hovered ? (
                      <Pause className={`h-4 w-4 md:h-5 md:w-5 ${isPlaying ? 'fill-current' : ''}`} />
                    ) : (
                      <div className="opacity-85">
                        <LottieViewer />
                      </div>
                    )}
                  </>
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
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleSetPlaylistAdd} className="flex items-center gap-3 py-3 cursor-pointer">
          <ListPlus className="h-4 w-4" />
          <span className="text-sm">Add to Playlist</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export default SongComponent
