import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { useMemo, useState } from "react"
import { addSongsToPlaylist } from "@/lib/actions"
import { ListPlus } from "lucide-react"
import type { PlaylistType } from "@/types/AppTypes"
import { useMusicStore } from "@/stores/useMusicStore"
import { useDebounce } from "use-debounce"
import { Input } from "@/components/ui/input"
import PlaylistAddSongItem from "./PlaylistAddSongItem"

interface PlaylistAddSongsButtonProps {
  playlist: PlaylistType
}
const PlaylistAddSongsButton = ({ playlist }: PlaylistAddSongsButtonProps) => {
  const songCache = useMusicStore((f) => f.songCache)
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set())
  const [isAdding, setIsAdding] = useState(false)
  const [searchVal, setSearchVal] = useState("")
  const [value] = useDebounce(searchVal, 300)
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
    const res = await addSongsToPlaylist(playlist.id, Array.from(selectedSongs))
    setIsAdding(false)
    if (res) {
      setSelectedSongs(new Set())
      setOpen(false)
    }
  }


  const suggestions = useMemo(() => {
    const inPlaylist = new Set(playlist.songIds)
    const pool = songCache.filter((s) => !inPlaylist.has(s.id))
    const q = value.trim().toLowerCase()
    if (!q) return pool.slice(0, 30)
    const words = q.split(/\s+/)
    return pool.filter((s) => words.every((w) => `${s.title} ${s.artist}`.toLowerCase().includes(w))).slice(0, 50)
  }, [value, songCache, playlist.songIds])



  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSelectedSongs(new Set()) }}>
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
                key={song.id}
                song={song}
                isSelected={selectedSongs.has(song.id)}
                onToggle={() => handlePlaylistToggle(song.id)}
              />
            ))}

            {suggestions?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {songCache.length ? "No matching songs that aren't already in this playlist." : "Your library is empty."}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddToPlaylists}
            disabled={selectedSongs.size === 0 || isAdding}
          >
            {isAdding ? "Adding..." : `Add ${selectedSongs.size} song${selectedSongs.size !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PlaylistAddSongsButton
