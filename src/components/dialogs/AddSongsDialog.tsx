import { DIALOG_LARGE } from "@/components/base/dialogSize"
import { useMemo, useState } from "react"
import { useDebounce } from "use-debounce"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SongRow } from "@/components/song/SongRow"
import { VirtualList } from "@/components/base/VirtualList"
import { searchSongs } from "@/lib/catalog"
import { useLibraryStore } from "@/stores/useLibraryStore"

type Props = {
  open: boolean
  onOpenChange: (o: boolean) => void
  title?: string
  description: string
  /** Songs already in the target (hidden from the picker). */
  excludeIds: readonly string[]
  onAdd: (songIds: string[]) => Promise<unknown>
}

/** Pick songs from the library (search, click to select, Shift/Ctrl not needed) and add them to a playlist or tag. */
export default function AddSongsDialog({ open, onOpenChange, title = "Add songs", description, excludeIds, onAdd }: Props) {
  const songs = useLibraryStore((s) => s.songs)
  const [query, setQuery] = useState("")
  const [q] = useDebounce(query, 200)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const results = useMemo(() => {
    const inPl = new Set(excludeIds)
    const pool = songs.filter((s) => !inPl.has(s.id))
    return (q.trim() ? searchSongs(pool, q) : pool).slice(0, 100)
  }, [songs, excludeIds, q])

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
    const r = await onAdd([...selected])
    setSaving(false)
    if (r) close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className={DIALOG_LARGE}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your library…" aria-label="Search songs" />
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col pr-3">
            <VirtualList items={results} getKey={(s) => s.id} estimateSize={52} threshold={40} renderItem={(s) => <SongRow song={s} variant="compact" selected={selected.has(s.id)} onToggleSelect={() => toggle(s.id)} />} />
            {!results.length && <p className="py-8 text-center text-sm text-muted-foreground">{songs.length ? "No matching songs that aren't already in this playlist." : "Your library is empty. Add MP3s to your music folder, or use the YouTube page."}</p>}
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
