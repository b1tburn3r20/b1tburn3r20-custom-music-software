
"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogDescription } from "@/components/ui/dialog"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"



const DeleteSong = () => {
  const songToDelete = useDirectoryStore((f) => f.songToDelete)
  const songToDeleteModalOpen = useDirectoryStore((f) => f.songToDeleteModalOpen)
  const setSongToDelete = useDirectoryStore((f) => f.setSongToDelete)
  const setSongToDeleteModalOpen = useDirectoryStore((f) => f.setSongToDeleteModalOpen)
  const [deleting, setDeleting] = useState(false)
  const currentDir = useDirectoryStore((f) => f.currentDir)
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  const setCurrentlyPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const handleOpenChange = (open: boolean) => {
    setSongToDeleteModalOpen(open)
    if (!open) {
      setTimeout(() => {
        setSongToDelete(null)
      }, 500)
    }
  }
  const handleClose = () => {
    handleOpenChange(false)
  }

  const confirmDeleteSong = async () => {
    setDeleting(true)
    try {
      const deleted: any = await (window as any).electron.deleteFile(songToDelete?.path);
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
    if (songToDelete?.path === currentlyPlaying?.path) {
      setCurrentlyPlaying(null)
    }
    toast.success(<div className="cursor-pointer" onClick={() => toast.dismiss()}>Removed <span className="text-primary">{songToDelete?.metadata?.title}</span> from {currentDir?.playlistName}</div>, {
      position: "top-center",
      dismissible: true,
    })
  }

  return (
    <Dialog open={songToDeleteModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Removed <span className="text-primary font-semibold">{songToDelete?.metadata?.title} </span> from {currentDir?.playlistName}?
          </DialogTitle>
          <DialogDescription>
            This just removes the song from the playlist, you can add it back by downloading it again
          </DialogDescription>
        </DialogHeader>
        <div className="p-2 grid grid-cols-2 gap-4 h-14">
          <Button autoFocus onClick={() => handleClose()} className="w-full h-full cursor-pointer rounded-2xl" variant="secondary">Nah</Button>
          <Button onClick={() => confirmDeleteSong()} className="cursor-pointer w-full h-full rounded-2xl" variant="destructive">{deleting ? <Loader2 className="animate-spin" /> : <span>BOOM!</span>}</Button>
        </div>
      </DialogContent>
    </Dialog >


  )
}

export default DeleteSong 
