import { DIALOG_LARGE } from "@/components/base/dialogSize"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { addSongToPlaylists, addSongsToPlaylist } from "@/lib/actions"
import { dialogs, useDialogStore } from "@/stores/useDialogStore"
import { useUserStore } from "@/stores/useUserStore"
import { resolveSongs, useLibraryStore } from "@/stores/useLibraryStore"
import { Artwork } from "@/components/base/Artwork"
import { cn } from "@/lib/utils"
import { ListButton } from "@/components/base/Layout"
import { Check, Plus } from "lucide-react"
import { useEffect, useState } from "react"

/** Pick one or more playlists for one or more songs. Playlists that already contain all the songs are marked. */
export default function AddToPlaylistDialog() {
  const songs = useDialogStore((s) => s.addToPlaylistSongs)
  const playlists = useUserStore((s) => s.playlists)
  const byId = useLibraryStore((s) => s.songsById)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  useEffect(() => setSelected(new Set()), [songs])
  const close = () => dialogs().openAddToPlaylist(null)
  const ids = songs?.map((s) => s.id) ?? []

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const save = async () => {
    if (!songs || !selected.size) return
    setSaving(true)
    if (ids.length === 1) await addSongToPlaylists(ids[0], [...selected])
    else for (const pid of selected) await addSongsToPlaylist(pid, ids)
    setSaving(false)
    close()
  }

  const title = songs?.length === 1 ? `“${songs[0].metadata.title}”` : `${songs?.length ?? 0} songs`
  return (
    <Dialog open={Boolean(songs)} onOpenChange={(o) => !o && close()}>
      <DialogContent className={DIALOG_LARGE}>
        <DialogHeader>
          <DialogTitle>Add to playlist</DialogTitle>
          <DialogDescription>Add {title} to one or more playlists.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 pr-2">
          <div className="flex flex-col gap-1">
            <ListButton
              onClick={() => {
                close()
                dialogs().openPlaylistForm({ mode: "create", songIds: ids })
              }}
            >
              <span className="flex size-art-sm items-center justify-center rounded-md bg-muted">
                <Plus className="size-5" />
              </span>
              <span className="font-medium">New playlist…</span>
            </ListButton>
            {playlists.map((p) => {
              const hasAll = ids.length > 0 && ids.every((id) => p.songIds.includes(id))
              const isSel = selected.has(p.id)
              const cover = resolveSongs(p.songIds.slice(0, 1), byId)[0]?.metadata.thumbnail
              return (
                <ListButton key={p.id} disabled={hasAll} aria-pressed={isSel} selected={isSel} onClick={() => toggle(p.id)}>
                  <span className={cn("size-5 rounded border-2 flex items-center justify-center", isSel || hasAll ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/50")}>
                    {(isSel || hasAll) && <Check className="size-3" />}
                  </span>
                  <Artwork src={cover} size="sm" />
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium truncate">{p.name}</span>
                    <span className="block text-sm text-muted-foreground">{hasAll ? "Already added" : `${p.songIds.length} ${p.songIds.length === 1 ? "song" : "songs"}`}</span>
                  </span>
                </ListButton>
              )
            })}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!selected.size || saving}>
            {saving ? "Adding…" : `Add to ${selected.size} playlist${selected.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
