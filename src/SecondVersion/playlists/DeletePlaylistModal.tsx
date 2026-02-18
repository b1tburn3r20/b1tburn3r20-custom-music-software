"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAppStore } from "@/stores/useAppStore"
import { removePlaylist } from "@/utils/musicutils"
import { ArrowLeft, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

const DeletePlaylistModal = () => {
  const deleteData = useAppStore((f) => f.playlistForDelete)
  const setDeleteData = useAppStore((f) => f.setPlaylistForDelete)
  const [open, setOpen] = useState(false)
  const confirmDelete = async () => {
    if (!deleteData) {
      return
    }
    setOpen(false)
    const delId = deleteData.id
    const response = await (window as any).electron.deletePlaylist(delId)
    removePlaylist(deleteData?.id)
    if (response?.success) {
      removePlaylist(delId)
    }
    toast.info("Playlist Deleted.", {
      closeButton: true,
      position: "top-right"
    })

  }
  const cancel = () => {
    setDeleteData(null)
  }

  const handleOpenChange = () => {
    if (open) {
      setOpen(false)
    } else {
      setOpen(true)
    }
  }

  useEffect(() => {
    if (deleteData?.id) {
      setOpen(true)
    } else {
      setOpen(false)
    }
  }, [deleteData?.id])

  return (
    <div>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Playlist</DialogTitle>
            <DialogDescription>Are you sure? It's your world boss, i'm just makin sure you're sure lol, if you're sure, i'm sure and we can delete it <span className="italic">for sure.</span></DialogDescription>
          </DialogHeader>
          <div>
            <div className="px-3 py-2 border-white/5 bg-white/5 rounded-xl">
              <p className="text-xs font-semibold text-white/90 truncate">
                {deleteData?.name}
              </p>
              <p className="text-[10px] text-white/50 mt-0.5">
                {deleteData?.songs?.length} {deleteData?.songs?.length === 1 ? 'song' : 'songs'}
              </p>
            </div>
            <div className="flex items-center w-full gap-1 mt-4">
              <button
                onClick={() => cancel()}
                className="flex items-center justify-center gap-3 w-full px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded-md transition-colors group"
              >
                <ArrowLeft className="h-4 w-4 text-white/60 group-hover:text-white transition-colors" />
                <span className="font-medium">Nevermind</span>
              </button>


              <button
                onClick={() => confirmDelete()}
                className="flex justify-center items-center gap-3 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-md transition-colors group"
              >
                <Trash2 className="h-4 w-4 text-red-400/80 group-hover:text-red-400 transition-colors" />
                <span className="font-medium">Delete playlist</span>
              </button>


            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

export default DeletePlaylistModal
