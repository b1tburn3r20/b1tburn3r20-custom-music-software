import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/stores/useAppStore"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { useMusicStore } from "@/stores/useMusicStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import type { PlaylistType } from "@/types/AppTypes"
import type { Song } from "@/types/DirectoryTypes"
import { extendQueue } from "@/utils/musicutils"
import { Play, Trash2, Pause, Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

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
  const removeSong = useMusicStore((f) => f.removeSong)
  const rootDir = useDirectoryStore((f) => f.rootDir)
  const [deleting, setDeleting] = useState(false)
  const setView = useAppStore((f) => f.setView)
  const setActiveAlbum = useMusicStore((f) => f.setActiveAlbum)
  const setExpanded = useSettingsStore((f) => f.setPlayerExpanded)
  const setActiveArtist = useMusicStore((f) => f.setActiveArtist)

  const handleViewAlbum = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(false)
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

  const handleViewArtist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(false)
    try {
      const result = await (window as any).electron.getArtistByName({
        rootDir,
        artistName: song?.metadata?.artist,
      });
      console.log("hi", result)
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




  const handleClick = () => {
    if (deleting) return

    if (isPlaying) {
      isPaused ? onResume() : onPause()
    } else {
      onPlay(song)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await (window as any).electron.deleteSong(song.path)
      removeSong(song)
    } finally {
      setDeleting(false)
    }
  }

  const showPauseIcon = isPlaying && !isPaused
  const shouldFetchMoreSongs =
    queue.length - (queue.indexOf(currentlyPlaying) + 1) < 3

  useEffect(() => {
    if (shouldFetchMoreSongs && isPlaying) {
      const pathFlatmap = queue.map((f) => f.path)
      extendQueue(rootDir, song.path, pathFlatmap)
    }
  }, [currentlyPlaying])

  const lastPlaylistSongInQueue = useMemo(() => {
    if (!playingPlaylist) return null

    const playlistPaths = new Set(
      playingPlaylist.songs.map((s) => s.path)
    )

    let lastMatch: Song | null = null
    for (const qSong of queue) {
      if (playlistPaths.has(qSong.path)) {
        lastMatch = qSong
      }
    }

    return lastMatch
  }, [queue, playingPlaylist])

  const shouldShowSeparator =
    (!playingPlaylist && index === 0) ||
    (playingPlaylist && lastPlaylistSongInQueue?.path === song.path)

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
