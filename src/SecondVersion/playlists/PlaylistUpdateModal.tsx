import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useMusicStore } from "@/stores/useMusicStore"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import PlaylistSelectItem from "./PlaylistSelect"
import { toast } from "sonner"

const PlaylistUpdateModal = () => {
  const open = useMusicStore((f) => f.isPlaylistModalOpen)
  const setOpen = useMusicStore((f) => f.setIsPlaylistModalOpen)
  const updateData = useMusicStore((f) => f.playlistUpdateData)
  const setUpdateData = useMusicStore((f) => f.setPlaylistUpdateData)
  const playlists = useMusicStore((f) => f.playlists)
  const replacePlaylist = useMusicStore((f) => f.replacePlaylist)

  const [selectedPlaylists, setSelectedPlaylists] = useState<Set<string>>(new Set())
  const [isAdding, setIsAdding] = useState(false)

  const handleOpenChange = () => {
    if (open) {
      toast.info("Hello")
      setOpen(false)
      setTimeout(() => {
        setUpdateData(null)
        setSelectedPlaylists(new Set())
      }, 300)
    } else {
      setOpen(true)
    }
  }

  const handlePlaylistToggle = (playlistId: string) => {
    setSelectedPlaylists((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(playlistId)) {
        newSet.delete(playlistId)
      } else {
        newSet.add(playlistId)
      }
      return newSet
    })
  }

  const handleAddToPlaylists = async () => {
    if (selectedPlaylists.size === 0) return

    setIsAdding(true)
    try {
      const promises = Array.from(selectedPlaylists).map((playlistId) =>
        (window as any).electron.addSongToPlaylist(playlistId, updateData?.path)
      )

      const responses = await Promise.all(promises)

      responses.forEach((response: any) => {
        if (response?.success) {
          replacePlaylist(response.playlist)
        }
      })

      setOpen(false)
      setTimeout(() => {
        setUpdateData(null)
        setSelectedPlaylists(new Set())
      }, 300)
    } catch (error) {
      console.error("Failed to add song to playlists:", error)
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add to Playlist</DialogTitle>
          <DialogDescription>
            Add "{updateData?.metadata.title}" to one or more playlists
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]  pr-4">
          <div className="space-y-2 m-4">
            {playlists?.map((playlist) => (
              <PlaylistSelectItem
                key={playlist.id}
                playlist={playlist}
                isSelected={selectedPlaylists.has(playlist.id)}
                onToggle={() => handlePlaylistToggle(playlist.id)}
              />
            ))}

            {playlists?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No playlists yet. Create one to get started!
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleOpenChange}  >
            Cancel
          </Button>
          <Button
            onClick={handleAddToPlaylists}
            disabled={selectedPlaylists.size === 0 || isAdding}
          >
            {isAdding ? "Adding..." : `Add to ${selectedPlaylists.size} playlist${selectedPlaylists.size !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PlaylistUpdateModal
