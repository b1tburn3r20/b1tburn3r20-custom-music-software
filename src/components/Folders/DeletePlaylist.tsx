
"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogDescription } from "@/components/ui/dialog"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"



const DeletePlaylist = () => {
  const playlistToDelete = useDirectoryStore((f) => f.playlistToDelete)
  const playlistToDeleteModalOpen = useDirectoryStore((f) => f.playlistToDeleteModalOpen)
  const setPlaylistToDelete = useDirectoryStore((f) => f.setPlaylistToDelete)
  const setPlaylistToDeleteModalOpen = useDirectoryStore((f) => f.setPlaylistToDeleteModalOpen)
  const [deleting, setDeleting] = useState(false)
  const currentDir = useDirectoryStore((f) => f.currentDir)
  const setCurrentDir = useDirectoryStore((f) => f.setCurrentDir)

  const handleOpenChange = (open: boolean) => {
    setPlaylistToDeleteModalOpen(open)
    if (!open) {
      setTimeout(() => {
        setPlaylistToDelete(null)
      }, 500)
    }
  }
  const handleClose = () => {
    handleOpenChange(false)
  }

  const confirmDeleteFolder = async () => {
    setDeleting(true)
    try {
      const deleted: any = await (window as any).electron.deleteFolder(playlistToDelete?.path);
      if (deleted?.success) {
        handleOpenChange(false)
        handleDelete()
      }
    } catch (error) {
      console.error(error)
    } finally {
      setDeleting(false)
    }
  }

  const handleDelete = () => {
    if (playlistToDelete?.path === currentDir?.path) {
      setCurrentDir(null)
    }
    toast.success(<div className="cursor-pointer" onClick={() => toast.dismiss()}>Deleted your <span className="text-primary">{playlistToDelete?.name}</span> playlist</div>, {
      position: "top-center",
      dismissible: true,
    })
  }

  return (
    <Dialog open={playlistToDeleteModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Delete Your <span className="text-primary font-semibold">{playlistToDelete?.name} </span>Playlist?
          </DialogTitle>
          <DialogDescription>
            This isnt reversible... seriously. All of the songs inside of it too, gone! Are you sure?
          </DialogDescription>
        </DialogHeader>
        <div className="p-2 grid grid-cols-2 gap-4 h-14">
          <Button autoFocus onClick={() => handleClose()} className="w-full h-full cursor-pointer rounded-2xl" variant="secondary">Nevermind</Button>
          <Button onClick={() => confirmDeleteFolder()} className="cursor-pointer w-full h-full rounded-2xl" variant="destructive">{deleting ? <Loader2 className="animate-spin" /> : <span>KABOOM!</span>}</Button>
        </div>
      </DialogContent>
    </Dialog >


  )
}

export default DeletePlaylist
