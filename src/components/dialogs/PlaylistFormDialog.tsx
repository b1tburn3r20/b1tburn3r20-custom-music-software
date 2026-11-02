import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createPlaylist, updatePlaylist } from "@/lib/actions"
import { errorMessage } from "@/lib/api"
import { useDialogStore } from "@/stores/useDialogStore"
import { useUserStore } from "@/stores/useUserStore"
import { navigate } from "@/stores/useAppStore"
import { useEffect, useState } from "react"

const SUGGESTIONS = ["Rock", "Rap", "Pop", "Indie Pop", "Japanese", "Hip-Hop", "Old School", "Breakcore", "Korean"]

/** Create or edit (rename/description) a playlist. Validation errors from main are shown inline. */
export default function PlaylistFormDialog() {
  const form = useDialogStore((s) => s.playlistForm)
  const close = () => useDialogStore.getState().openPlaylistForm(null)
  const playlists = useUserStore((s) => s.playlists)
  const editing = form?.mode === "edit" ? playlists.find((p) => p.id === form.playlistId) : undefined
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [placeholder] = useState(() => SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)])

  useEffect(() => {
    if (!form) return
    setName(editing?.name ?? "")
    setDescription(editing?.description ?? "")
    setError(null)
  }, [form, editing?.name, editing?.description])

  // Live duplicate check (main validates again on save).
  const trimmed = name.trim().replace(/\s+/g, " ")
  const clash = trimmed && playlists.find((p) => p.id !== editing?.id && p.name.toLowerCase() === trimmed.toLowerCase())
  const shownError = error ?? (clash ? `You already have a playlist called "${clash.name}".` : null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form || !trimmed || clash) return
    setSaving(true)
    try {
      if (form.mode === "create") {
        const pl = await createPlaylist(trimmed, description, form.songIds ?? [])
        close()
        if (!form.songIds?.length) navigate({ name: "playlist", id: pl.id })
      } else {
        await updatePlaylist(form.playlistId, { name: trimmed, description })
        close()
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const isCreate = form?.mode === "create"
  return (
    <Dialog open={Boolean(form)} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isCreate ? "New playlist" : "Edit playlist"}</DialogTitle>
            <DialogDescription>
              {isCreate ? (form?.songIds?.length ? `The selected song will be added to it.` : "Give your playlist a name and an optional description.") : `Rename “${editing?.name ?? ""}” or change its description.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="playlist-name">Name</Label>
            <Input
              id="playlist-name"
              autoFocus
              value={name}
              maxLength={100}
              placeholder={`${placeholder}…`}
              aria-invalid={Boolean(shownError)}
              aria-describedby={shownError ? "playlist-name-error" : undefined}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
            />
            {shownError && (
              <p id="playlist-name-error" role="alert" className="text-sm text-destructive">
                {shownError}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="playlist-description">Description (optional)</Label>
            <Input id="playlist-description" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} placeholder="Add a description…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!trimmed || Boolean(clash) || saving}>
              {isCreate ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
