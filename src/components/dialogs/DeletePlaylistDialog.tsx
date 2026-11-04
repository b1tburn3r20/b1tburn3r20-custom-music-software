import { Button } from "@/components/ui/button"
import { Modal } from "@/components/base/Modal"
import { deletePlaylist } from "@/lib/actions"
import { dialogs, useDialogStore } from "@/stores/useDialogStore"
import { useUserStore } from "@/stores/useUserStore"
import { Trash2 } from "lucide-react"

export default function DeletePlaylistDialog() {
  const id = useDialogStore((s) => s.playlistToDelete)
  const pl = useUserStore((s) => s.playlists.find((p) => p.id === id))
  const close = () => dialogs().confirmDeletePlaylist(null)
  const n = pl?.songIds.length ?? 0
  return (
    <Modal
      open={Boolean(id && pl)}
      onClose={close}
      title={`Delete “${pl?.name ?? ""}”?`}
      description={`The playlist (${n} ${n === 1 ? "song" : "songs"}) is removed. The songs stay in your library.`}
      footer={
        <>
          <Button variant="secondary" autoFocus onClick={close}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={async () => id && (await deletePlaylist(id)) && close()}>
            <Trash2 /> Delete playlist
          </Button>
        </>
      }
    />
  )
}
