import { useMemo, useState } from "react"
import { useDebounce } from "use-debounce"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SongRow } from "@/components/song/SongRow"
import { addSongsToPlaylist } from "@/lib/actions"
import { searchSongs } from "@/lib/catalog"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { useUserStore } from "@/stores/useUserStore"

/** Pick songs from the library to add to a playlist (songs already in it are hidden). */
export default function AddSongsDialog({ playlistId, open, onOpenChange }: { playlistId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const playlist = useUserStore((s) => s.playlists.find((p) => p.id === playlistId))
  const songs = useLibraryStore((s) => s.songs)
  const [query, setQuery] = useState("")
  const [q] = useDebounce(query, 200)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const results = useMemo(() => {
    const inPl = new Set(playlist?.songIds ?? [])
    const pool = songs.filter((s) => !inPl.has(s.id))
    return (q.trim() ? searchSongs(pool, q) : pool).slice(0, 100)
  }, [songs, playlist?.songIds, q])

  const close = (o: boolean) => {
    onOpenChange(o)
    if (!o) {
      setSelected(new Set())
      setQuery("")
    }
  }
  const toggle = (id: string) =>
    setSelected((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const save = async () => {
    setSaving(true)
    const r = await addSongsToPlaylist(playlistId, [...selected])
    setSaving(false)
    if (r) close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add songs</DialogTitle>
          <DialogDescription>Add songs to “{playlist?.name}”.</DialogDescription>
        </DialogHeader>
        <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your library…" aria-label="Search songs" />
        <ScrollArea className="h-96">
          <div className="flex flex-col pr-3">
            {results.map((s) => (
              <SongRow key={s.id} song={s} variant="compact" selected={selected.has(s.id)} onToggleSelect={() => toggle(s.id)} />
            ))}
            {!results.length && <p className="py-8 text-center text-sm text-muted-foreground">{songs.length ? "No matching songs that aren't already in this playlist." : "Your library is empty."}</p>}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!selected.size || saving}>
            {saving ? "Adding…" : `Add ${selected.size} song${selected.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
