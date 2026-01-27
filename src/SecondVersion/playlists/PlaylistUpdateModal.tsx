import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useMusicStore } from "@/stores/useMusicStore"
import PlaylistSelect from "./PlaylistSelect"

const PlaylistUpdateModal = () => {
  const open = useMusicStore((f) => f.isPlaylistModalOpen)
  const setOpen = useMusicStore((f) => f.setIsPlaylistModalOpen)
  const updateData = useMusicStore((f) => f.playlistUpdateData)
  const setUpdateData = useMusicStore((f) => f.setPlaylistUpdateData)
  const playlists = useMusicStore((f) => f.playlists)
  const replacePlaylist = useMusicStore((f) => f.replacePlaylist)
  const handleOpenChange = () => {
    if (open) {
      setOpen(false)
      setTimeout(() => {
        setUpdateData(null)
      }, 300)
    } else {
      setOpen(true)
    }
  }

  const handlePlaylistSelect = async (data: any) => {
    try {
      const response: any = await (window as any).electron.addSongToPlaylist(data.id, updateData?.path)
      console.log(response)
      if (response?.success) {
        replacePlaylist(response.playlist)
        setTimeout(() => {
          setUpdateData(null)
        }, 300)
      }
    } catch (error) {
      console.error("This is sad")
    }
  }


  return (
    <div>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add "{updateData?.metadata.title}" to playlist?</DialogTitle>
            <DialogDescription>Select a playlist or create a new one to add the song to</DialogDescription>
          </DialogHeader>
          <div>
            {playlists?.map((playlist) => (
              <PlaylistSelect playlist={playlist} onPlaylistSelect={handlePlaylistSelect} />
            ))}
          </div>
        </DialogContent>
      </Dialog>


    </div>
  )
}

export default PlaylistUpdateModal
