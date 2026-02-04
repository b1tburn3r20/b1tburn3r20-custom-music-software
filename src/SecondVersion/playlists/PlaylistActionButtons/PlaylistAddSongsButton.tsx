import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { ListPlus } from "lucide-react"
import type { PlaylistType } from "@/types/AppTypes"
import { useMusicStore } from "@/stores/useMusicStore"
import { useDebounce } from "use-debounce"
import { Input } from "@/components/ui/input"
import PlaylistAddSongItem from "./PlaylistAddSongItem"
import { useAppStore } from "@/stores/useAppStore"

interface PlaylistAddSongsButtonProps {
  playlist: PlaylistType
}
const PlaylistAddSongsButton = ({ playlist }: PlaylistAddSongsButtonProps) => {
  const songCache = useMusicStore((f) => f.songCache)
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set())
  const [isAdding, setIsAdding] = useState(false)
  const setActivePlaylist = useAppStore((f) => f.setCurrentPlaylist)
  const [searchVal, setSearchVal] = useState("")
  const replacePlaylist = useMusicStore((f) => f.replacePlaylist)
  const [value] = useDebounce(searchVal, 300)
  const [suggestions, setSuggestions] = useState(songCache.slice(0, 10))
  const [open, setOpen] = useState(false)
  const handlePlaylistToggle = (songPath: string) => {
    setSelectedSongs((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(songPath)) {
        newSet.delete(songPath)
      } else {
        newSet.add(songPath)
      }
      return newSet
    })
  }
  const handleAddToPlaylists = async () => {
    if (selectedSongs.size === 0) return

    setIsAdding(true)
    try {
      const promises = Array.from(selectedSongs).map((songPath) =>
        (window as any).electron.addSongToPlaylist(playlist.id, songPath)
      )

      const responses = await Promise.all(promises)

      responses.forEach((response: any) => {
        if (response?.success) {
          replacePlaylist(response.playlist)
          setActivePlaylist(response.playlist)
        }
      })

      setTimeout(() => {
        setOpen(false)
      }, 300)
    } catch (error) {
      console.error("Failed to add song to playlists:", error)
    } finally {
      setIsAdding(false)
    }
  }

  useEffect(() => {
    const cacheSuggestions = songCache.filter((song) => {
      const query = value?.toLowerCase()
      const titleMatch = song.title?.toLowerCase().includes(query)

      const artistMatch = song.artist?.toLowerCase().includes(query)
      return titleMatch || artistMatch
    }).slice(0, 15)
    setSuggestions(cacheSuggestions)
  }, [value])



  return (
    <Dialog open={open} >
      <DialogTrigger asChild>
        <Button onClick={() => setOpen(true)} className="rounded-full h-14 w-14">
          <ListPlus className="" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add to Playlist</DialogTitle>
          <DialogDescription>
            Add songs to your "{playlist.name}" playlist
          </DialogDescription>
        </DialogHeader>
        <div>
          <Input value={searchVal} onChange={(e) => setSearchVal(e.target.value)} placeholder="Search songs..." />
        </div>
        <ScrollArea className="h-[400px]">
          <div className="space-y-2 m-4 min-w-0 truncate p-4">

            {suggestions?.map((song) => (
              <PlaylistAddSongItem
                key={song.path}
                song={song}
                isSelected={selectedSongs.has(song.path)}
                onToggle={() => handlePlaylistToggle(song.path)}
              />
            ))}

            {suggestions?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No songs match.
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline">
            Cancel
          </Button>
          <Button
            onClick={handleAddToPlaylists}
            disabled={selectedSongs.size === 0 || isAdding}
          >
            {isAdding ? "Adding..." : `Add to ${selectedSongs.size} playlist${selectedSongs.size !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PlaylistAddSongsButton
