import { Button } from "@/components/ui/button"
import { Modal } from "@/components/base/Modal"
import { deleteSongFromLibrary } from "@/lib/actions"
import { dialogs, useDialogStore } from "@/stores/useDialogStore"
import { useUserStore } from "@/stores/useUserStore"
import { Loader2, Trash2 } from "lucide-react"
import { useState } from "react"

/** Confirmation before deleting a song from the library (file goes to the trash). */
export default function DeleteSongDialog() {
  const song = useDialogStore((s) => s.songToDelete)
  const inPlaylists = useUserStore((s) => (song ? s.playlists.filter((p) => p.songIds.includes(song.id)).length : 0))
  const liked = useUserStore((s) => (song ? s.likedIds.has(song.id) : false))
  const [deleting, setDeleting] = useState(false)
  const close = () => !deleting && dialogs().confirmDeleteSong(null)
  const confirm = async () => {
    if (!song) return
    setDeleting(true)
    const ok = await deleteSongFromLibrary(song.id)
    setDeleting(false)
    if (ok) dialogs().confirmDeleteSong(null)
  }
  const where = [inPlaylists ? `${inPlaylists} playlist${inPlaylists === 1 ? "" : "s"}` : null, liked ? "your likes" : null, "your listening history"].filter(Boolean).join(", ")
  return (
    <Modal
      open={Boolean(song)}
      onClose={close}
      title={`Delete “${song?.metadata.title ?? ""}”?`}
      description={`The file is moved to your system trash and removed from your library, ${where}.`}
      footer={
        <>
          <Button variant="secondary" autoFocus onClick={close} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={deleting}>
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
          </Button>
        </>
      }
    />
  )
}
