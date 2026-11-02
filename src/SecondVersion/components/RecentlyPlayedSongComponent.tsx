import LottieViewer from "@/components/helpers/lottie-viewer"
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { useMusicStore } from "@/stores/useMusicStore"
import { openAlbumForSong, openArtist } from "@/utils/musicutils"
import type { Song } from "@/types/DirectoryTypes"
import { ListPlus, Pause, Play, Trash2 } from "lucide-react"
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
  const [hovered, setHovered] = useState(false)
  const setPlaylistUpdateData = useMusicStore((f) => f.setPlaylistUpdateData)
  const setIsPlaylistModalOpen = useMusicStore((f) => f.setIsPlaylistModalOpen)
  const requestDeleteSong = useDirectoryStore((f) => f.requestDeleteSong)


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
  const handleAlbumClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    openAlbumForSong(song.id)
  }


  const handleViewArtist = (e: React.MouseEvent, artist: string) => {
    e.stopPropagation()
    openArtist(artist.trim())
  }




  const handleDelete = () => {
    requestDeleteSong(song)
  }

  const handleSetPlaylistAdd = () => {
    setPlaylistUpdateData(song)
    setTimeout(() => {
      setIsPlaylistModalOpen(true)
    }, 150)
  }



  const showPauseIcon = isPlaying && !isPaused
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onMouseOver={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
          onClick={() => handleClick()}
          className="group relative select-none flex flex-col gap-2 p-3 rounded-xl hover:bg-accent/50 transition-all cursor-pointer "

        >
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
            <img
              src={song.metadata.thumbnail as string}
              alt={song.metadata.title}
              className="w-full h-full object-cover"
            />
            <div className={`absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center ${isPlaying ? 'opacity-100' : ''}`}>
              {showPauseIcon ? (
                <>
                  {hovered ? (

                    <Pause className={`h-4 w-4 md:h-15 md:w-15 ${isPlaying ? 'fill-current' : ''}`} />
                  ) : (
                    <div className="opacity-80">
                      <LottieViewer />
                    </div>
                  )}

                </>
              ) : (
                <Play className={`h-4 w-4 md:h-15 md:w-15 ${isPlaying ? 'fill-current' : ''}`} />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-0.5 min-w-0">
            <p className={`text-sm md:text-base font-semibold truncate ${isPlaying ? "text-primary" : ""}`}>
              {song.metadata.title}
            </p>
            <div className={`flex items-center gap-2 text-xs md:text-sm text-muted-foreground truncate ${isPlaying ? "text-primary/70" : ""}`}>
              {song?.metadata.artist?.split(",").map((artist, index) => <p key={index} className="hover:underline cursor-pointer" onClick={(e) => handleViewArtist(e, artist)}>{artist}{index + 1 < song?.metadata?.artist?.split(",")?.length && (<span>,</span>)}</p>)}

            </div>
            {song?.metadata?.album && song?.metadata?.album !== "Unknown Album" ? (
              <p onClick={(e) => handleAlbumClick(e)} className={`hover:underline text-xs md:text-sm text-muted-foreground/60 truncate ${isPlaying ? "text-primary/70" : ""}`}>
                <span >{song?.metadata?.album}</span> <span >-</span> <span >{song.metadata?.year}</span>
              </p>
            ) : ""}


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
        <ContextMenuItem onClick={handleSetPlaylistAdd} className="flex items-center gap-3 py-3 cursor-pointer">
          <ListPlus className="h-4 w-4" />
          <span className="text-sm">Add to Playlist</span>
        </ContextMenuItem>


      </ContextMenuContent>
    </ContextMenu>
  )
}

export default RecentlyPlayedSongComponent
