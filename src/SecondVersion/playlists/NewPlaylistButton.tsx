import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ListPlus } from "lucide-react"
import { useState, useCallback } from "react"
import { toast } from "sonner"

const NewPlaylist = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [playlistName, setPlaylistName] = useState("")
  const [playlistDescription, setPlaylistDescription] = useState("")

  const handleCreatePlaylist = useCallback(async () => {
    toast.info("RAH")
    if (!playlistName.trim()) return

    const result = await (window as any).electron.createPlaylist(playlistName.trim(), playlistDescription.trim())
    toast.info("HERE")
    console.log("Create playlist response:", result)

    if (result.success) {
      setIsDialogOpen(false)
      setPlaylistName("")
      setPlaylistDescription("")

      window.location.reload()
    }
  }, [playlistName, playlistDescription])

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <div className="h-12 w-12 shrink-0 p-1 rounded-sm cursor-pointer">
          <div className="h-full w-full bg-background p-2 items-center flex justify-center rounded-sm">
            <ListPlus />
          </div>
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
              placeholder="My Awesome Playlist"
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
