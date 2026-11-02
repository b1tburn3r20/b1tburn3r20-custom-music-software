import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { deletePlaylist } from "@/lib/actions"
import { dialogs, useDialogStore } from "@/stores/useDialogStore"
import { useUserStore } from "@/stores/useUserStore"
import { Trash2 } from "lucide-react"

export default function DeletePlaylistDialog() {
  const id = useDialogStore((s) => s.playlistToDelete)
  const pl = useUserStore((s) => s.playlists.find((p) => p.id === id))
  const close = () => dialogs().confirmDeletePlaylist(null)
  return (
    <Dialog open={Boolean(id && pl)} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{pl?.name}”?</DialogTitle>
          <DialogDescription>
            The playlist ({pl?.songIds.length ?? 0} {pl?.songIds.length === 1 ? "song" : "songs"}) is removed. The songs stay in your library.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" autoFocus onClick={close}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              if (id && (await deletePlaylist(id))) close()
            }}
          >
            <Trash2 /> Delete playlist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
