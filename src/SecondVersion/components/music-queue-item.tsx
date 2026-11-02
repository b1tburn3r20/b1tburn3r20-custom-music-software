import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"
import { Separator } from "@/components/ui/separator"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { useMusicStore } from "@/stores/useMusicStore"
import type { Song } from "@/types/DirectoryTypes"
import { openAlbumForSong, openArtist } from "@/utils/musicutils"
import { jumpTo, playNext, removeFromQueue, togglePlay } from "@/player/controls"
import { Play, Trash2, Pause, X, ListPlus, ListStart } from "lucide-react"
import { memo } from "react"

interface MusicQueueItemProps {
  uid: string
  song: Song
  isCurrent: boolean
  isPlayed: boolean
  isPaused: boolean
  showSeparator: boolean
  addedByUser: boolean
}

const MusicQueueItem = memo(({ uid, song, isCurrent, isPlayed, isPaused, showSeparator, addedByUser }: MusicQueueItemProps) => {
  const requestDeleteSong = useDirectoryStore((f) => f.requestDeleteSong)
  const setExpanded = useSettingsStore((f) => f.setPlayerExpanded)

  const handleClick = () => (isCurrent ? togglePlay() : jumpTo(uid))
  const goAlbum = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(false)
    openAlbumForSong(song.id)
  }
  const goArtist = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(false)
    openArtist(song.metadata.artists?.[0] ?? song.metadata.artist)
  }
  const addToPlaylist = () => {
    useMusicStore.getState().setPlaylistUpdateData(song)
    setTimeout(() => useMusicStore.getState().setIsPlaylistModalOpen(true), 150)
  }
  const showPause = isCurrent && !isPaused

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={handleClick}
            className={`relative md:min-w-[400px] group flex select-none items-center gap-3 py-2 px-3 rounded-lg transition-all cursor-pointer active:scale-[0.98] hover:bg-accent/50 ${isCurrent ? "bg-muted/20" : ""} ${isPlayed ? "opacity-50" : ""}`}
          >
            <div className="relative h-12 w-12 md:h-14 md:w-14 shrink-0 overflow-hidden rounded-md bg-muted">
              {song.metadata.thumbnail && <img src={song.metadata.thumbnail} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <p className={`text-sm md:text-base font-semibold truncate ${isCurrent ? "text-primary" : ""}`}>{song.metadata.title}</p>
              <p className={`text-xs md:text-sm text-muted-foreground truncate ${isCurrent ? "text-primary/70" : ""}`}>
                <span onClick={goArtist} className="hover:underline cursor-pointer">{song.metadata.artist || "Unknown Artist"}</span>
                {addedByUser && <span className="ml-2 text-[10px] uppercase tracking-wide">· queued</span>}
              </p>
              {song.metadata.album && (
                <p onClick={goAlbum} className={`hover:underline cursor-pointer text-xs md:text-sm text-muted-foreground/60 truncate ${isCurrent ? "text-primary/70" : ""}`}>
                  {song.metadata.album}
                  {song.metadata.year ? ` - ${song.metadata.year}` : ""}
                </p>
              )}
            </div>
            <div className="absolute right-2 top-4">
              <Button variant="ghost" size="icon" className={`shrink-0 opacity-0 group-hover:opacity-100 group-hover:bg-primary/70 backdrop-blur-md transition-opacity ${isCurrent ? "opacity-100" : ""} md:h-10 md:w-10 h-9 w-9`}>
                {showPause ? <Pause className="h-4 w-4 md:h-5 md:w-5 fill-current" /> : <Play className="h-4 w-4 md:h-5 md:w-5 fill-current" />}
              </Button>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {!isCurrent && (
            <ContextMenuItem onClick={() => jumpTo(uid)} className="flex items-center gap-3 py-3 cursor-pointer">
              <Play className="h-4 w-4" /> <span className="text-sm">Play now</span>
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => playNext([song])} className="flex items-center gap-3 py-3 cursor-pointer">
            <ListStart className="h-4 w-4" /> <span className="text-sm">Play next</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={addToPlaylist} className="flex items-center gap-3 py-3 cursor-pointer">
            <ListPlus className="h-4 w-4" /> <span className="text-sm">Add to playlist</span>
          </ContextMenuItem>
          {!isCurrent && (
            <ContextMenuItem onClick={() => removeFromQueue(uid)} className="flex items-center gap-3 py-3 cursor-pointer">
              <X className="h-4 w-4" /> <span className="text-sm">Remove from queue</span>
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={() => requestDeleteSong(song)} className="flex items-center gap-3 py-3 cursor-pointer">
            <Trash2 className="h-4 w-4" /> <span className="text-sm">Delete from library</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {showSeparator && <Separator className="my-2" />}
    </div>
  )
})

export default MusicQueueItem
