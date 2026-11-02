import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu"
import { Separator } from "@/components/ui/separator"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { useMusicStore } from "@/stores/useMusicStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import type { PlaylistType } from "@/types/AppTypes"
import type { Song } from "@/types/DirectoryTypes"
import { openAlbumForSong, openArtist } from "@/utils/musicutils"
import { Play, Trash2, Pause, Loader2 } from "lucide-react"
import { useMemo } from "react"

interface MusicQueueItemProps {
  song: Song
  isPlaying: boolean
  onPlay: (data: Song) => void
  onPause: () => void
  onResume: () => void
  isPaused: boolean
  darker?: boolean
  index: number
  queue: Song[]
  currentlyPlaying: Song
  playingPlaylist?: PlaylistType
}

const MusicQueueItem = ({
  index,
  song,
  isPlaying,
  onPlay,
  onPause,
  onResume,
  isPaused,
  darker,
  queue,
  currentlyPlaying,
  playingPlaylist,
}: MusicQueueItemProps) => {
  const requestDeleteSong = useDirectoryStore((f) => f.requestDeleteSong)
  const deleting = useDirectoryStore((f) => f.songToDelete?.id === song.id)
  const setExpanded = useSettingsStore((f) => f.setPlayerExpanded)
  const currentlyPlayingSong = usePlayerStore((f) => f.currentlyPlaying)
  const handlePlayNext = () => {
    if (isPlaying) return
    const { queue, setQueue } = useMusicStore.getState()
    const updatedQueue = [...queue]
    const existingIndex = updatedQueue.findIndex(
      (s) => s.id === song.id
    )
    if (existingIndex !== -1) {
      updatedQueue.splice(existingIndex, 1)
    }
    const currentIndex = updatedQueue.findIndex(
      (s) => s.id === currentlyPlayingSong?.id
    )
    const insertIndex = currentIndex === -1
      ? 0
      : currentIndex + 1
    updatedQueue.splice(insertIndex, 0, song)
    setQueue(updatedQueue)
  }


  const handleViewAlbum = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(false)
    openAlbumForSong(song.id)
  }


  const handleViewArtist = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(false)
    openArtist(song.metadata.artists?.[0] ?? song.metadata.artist)
  }





  const handleClick = () => {
    if (deleting) return

    if (isPlaying) {
      isPaused ? onResume() : onPause()
    } else {
      onPlay(song)
    }
  }

  const handleDelete = () => {
    requestDeleteSong(song)
  }


  const showPauseIcon = isPlaying && !isPaused
  const lastPlaylistSongInQueue = useMemo(() => {
    if (!playingPlaylist) return null

    const playlistPaths = new Set(
      playingPlaylist.songs.map((s) => s.id)
    )

    let lastMatch: Song | null = null
    for (const qSong of queue) {
      if (playlistPaths.has(qSong.id)) {
        lastMatch = qSong
      }
    }

    return lastMatch
  }, [queue, playingPlaylist])

  const shouldShowSeparator =
    (!playingPlaylist && index === 0) ||
    (playingPlaylist && lastPlaylistSongInQueue?.id === song.id)

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={handleClick}
            className={`relative md:min-w-[400px] group flex select-none items-center gap-3 py-2 px-3 rounded-lg transition-all cursor-pointer active:scale-[0.98]
              ${isPlaying ? "bg-muted/20" : ""}
              ${darker ? "bg-black/80 hover:bg-muted/20" : "hover:bg-accent/50"}`}
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
              <p className={`text-xs md:text-sm text-muted-foreground truncate  ${isPlaying ? "text-primary/70" : ""}`}>
                <span

                  onClick={(e) => handleViewArtist(e)}
                  className={`${song?.metadata?.artist ? "hover:underline cursor-pointer" : ""}`}
                >
                  {song.metadata.artist || "Unknown Artist"}
                </span>
              </p>
              {song?.metadata?.album && song?.metadata?.album !== "Unknown Album" ? (
                <p

                  onClick={handleViewAlbum}
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
            <div className="absolute right-2 top-4">
              {deleting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className={`shrink-0 opacity-0 group-hover:opacity-100 group-hover:bg-primary/70 backdrop-blur-md  transition-opacity ${isPlaying ? "opacity-100" : ""
                    } md:h-10 md:w-10 h-9 w-9`}
                >
                  {showPauseIcon ? (
                    <Pause className="h-4 w-4 md:h-5 md:w-5 fill-current" />
                  ) : (
                    <Play className="h-4 w-4 md:h-5 md:w-5 fill-current" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56">
          <ContextMenuItem
            onClick={handlePlayNext}
            className="flex items-center gap-3 py-3 cursor-pointer"
          >
            <Play className="h-4 w-4" />
            <span className="text-sm">Play Next</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={handleDelete}
            className="flex items-center gap-3 py-3 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-sm">Delete Song</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {shouldShowSeparator && (
        <div>
          <Separator className="my-2" />
        </div>
      )}
    </div>
  )
}

export default MusicQueueItem
