import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ListPlus } from "lucide-react"
import { useState, useCallback } from "react"
import { useMusicStore } from "@/stores/useMusicStore"
import { useAppStore } from "@/stores/useAppStore"
import { useColorCacheStore } from "@/stores/useColorCacheStore"

const NewPlaylist = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [playlistName, setPlaylistName] = useState("")
  const [playlistDescription, setPlaylistDescription] = useState("")
  const setView = useAppStore((f) => f.setView)

  const setCurrentPlaylist = useAppStore((f) => f.setCurrentPlaylist)
  const addPlaylist = useMusicStore((f) => f.addPlaylist)

  const playlistNameSuggestions = ["Rock", "Rap", "Pop", "Indie Pop", "Japanese", "Hip-Hop", "Old School", "Breakcore", "Japanese Pop", "Korean"]

  const randomNumber = Math.floor(Math.random() * (playlistNameSuggestions.length - 0 + 1)) - 1
  const sugg = playlistNameSuggestions[randomNumber]
  const dominantColor = useColorCacheStore((state) =>
    state.getColor(undefined, "new-playlist-button")
  )


  const handleCreatePlaylist = useCallback(async () => {
    if (!playlistName.trim()) return

    const result = await (window as any).electron.createPlaylist(playlistName.trim(), playlistDescription.trim())
    console.log("Heres the res", result)
    if (result.success) {
      setIsDialogOpen(false)
      setPlaylistName("")
      setPlaylistDescription("")
      addPlaylist(result?.playlist)
      setCurrentPlaylist(result?.playlist)
      setView("playlist")
    }
  }, [playlistName, playlistDescription])

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <div className="h-12 w-12 shrink-0 p-1 rounded-sm cursor-pointer"


          style={{ backgroundColor: `rgba(${dominantColor}, 0.2)` }}
        >


          <ListPlus
            className="h-10 w-10 rounded-lg p-2"
            style={{ color: `rgb(${dominantColor})` }}


          />
        </div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Playlist</DialogTitle>
          <DialogDescription>
            Give your playlist a name and optional description.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Playlist Name</Label>
            <Input
              id="name"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder={`${sugg}..?`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const btn = document.getElementById("create-new-playlist-button")
                  if (btn) {
                    btn.click()
                  }
                }
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              value={playlistDescription}
              onChange={(e) => setPlaylistDescription(e.target.value)}
              placeholder="Add a description..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const btn = document.getElementById("create-new-playlist-button")
                  if (btn) {
                    btn.click()
                  }
                }
              }}

            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
            Cancel
          </Button>
          <Button id="create-new-playlist-button" onClick={handleCreatePlaylist} disabled={!playlistName.trim()}>
            Create Playlist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default NewPlaylist
