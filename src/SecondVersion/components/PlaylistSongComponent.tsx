import LottieViewer from "@/components/helpers/lottie-viewer"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"
import { useMusicStore } from "@/stores/useMusicStore"
import type { Song } from "@/types/DirectoryTypes"
import { Play, Trash2, Pause, Loader2, ListPlus, Shuffle } from "lucide-react"
import { useState } from "react"
interface PlaylistSongProps {
  song: Song
  isPlaying: boolean
  onPlay: (data: Song) => void
  onPause: () => void
  onResume: () => void
  isPaused: boolean
  darker?: boolean
  index: number
}

const PlaylistSongComponent = ({ song, isPlaying, onPlay, onPause, onResume, isPaused, darker, index }: PlaylistSongProps) => {
  const removeSong = useMusicStore((f) => f.removeSong)
  const setPlaylistUpdateData = useMusicStore((f) => f.setPlaylistUpdateData)
  const setIsPlaylistModalOpen = useMusicStore((f) => f.setIsPlaylistModalOpen)
  const [hovered, setHovered] = useState(false)
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
      removeSong(song)
    } catch (err) {
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


  const showPauseIcon = isPlaying && !isPaused

  return (
    <div
      key={index}
      className={`flex items-center  rounded-md transition-colors group cursor-pointer ${index % 2 === 0 ? "bg-muted/40" : "bg-transparent"}  `}
      onMouseOver={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="text-sm text-gray-400 w-14 h-10 flex justify-center items-center group-hover:text-white"
      >

        {hovered ? (
          <Button
            variant="ghost"
            size="icon"
            className={`shrink-0`}
            onClick={() => handleClick()}
          >
            {showPauseIcon ? (
              <Pause className={`h-4 w-4 md:h-5 md:w-5 ${isPlaying ? 'fill-current' : ''}`} />
            ) : (
              <Play className={`h-4 w-4 md:h-5 md:w-5 ${isPlaying ? 'fill-current' : ''}`} />
            )}
          </Button>

        ) : (
          <div>
            {showPauseIcon ? (
              <LottieViewer />
            ) : (
              <span >
                {index + 1}
              </span>
            )}
          </div>
        )}
      </div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={handleClick}
            className={`group w-full flex items-center gap-3 py-2 px-3 rounded-lg  transition-all cursor-pointer touch-manipulation `}
          >
            <div className="relative h-12 w-12 md:h-10 md:w-10 shrink-0 overflow-hidden rounded-md bg-muted">
              <img
                src={song.metadata.thumbnail as string}
                alt={song.metadata.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex flex-col gap-0.5">
              <p className={`text-sm md:text-base w-fit font-semibold truncate ${isPlaying ? "text-primary" : ""}`}>
                {song.metadata.title}
              </p>
              <p className={`text-xs md:text-sm text-muted-foreground truncate ${isPlaying ? "text-primary/70" : ""}`}>
                {song.metadata.artist || "Unknown Artist"} <span className="text-muted-foreground/50">•</span> <span className="text-muted-foreground/50">{song.metadata.year}</span>
              </p>
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
    </div>
  )
}

export default PlaylistSongComponent 
