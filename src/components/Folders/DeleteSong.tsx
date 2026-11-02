import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { deleteSongFromLibrary } from "@/lib/actions"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { useUserStore } from "@/stores/useUserStore"
import { Loader2, Trash2 } from "lucide-react"
import { useState } from "react"

/** Confirmation dialog for deleting a song from the library (and disk). */
const DeleteSong = () => {
  const song = useDirectoryStore((s) => s.songToDelete)
  const requestDeleteSong = useDirectoryStore((s) => s.requestDeleteSong)
  const playlists = useUserStore((s) => s.playlists)
  const liked = useUserStore((s) => (song ? s.likedIds.has(song.id) : false))
  const [deleting, setDeleting] = useState(false)
  const inPlaylists = song ? playlists.filter((p) => p.songIds.includes(song.id)).length : 0

  const close = () => {
    if (!deleting) requestDeleteSong(null)
  }

  const confirm = async () => {
    if (!song) return
    setDeleting(true)
    const ok = await deleteSongFromLibrary(song.id)
    setDeleting(false)
    if (ok) requestDeleteSong(null)
  }

  return (
    <Dialog open={Boolean(song)} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{song?.metadata.title}”?</DialogTitle>
          <DialogDescription>
            The file is moved to your system trash and removed from your library
            {inPlaylists ? `, ${inPlaylists} playlist${inPlaylists === 1 ? "" : "s"}` : ""}
            {liked ? ", your likes" : ""} and your listening history.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" autoFocus onClick={close} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={deleting}>
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteSong
