import { useEffect } from "react"
import { Heart, ListEnd, ListPlus, ListStart, Tags, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSelectionStore } from "@/stores/useSelectionStore"
import { dialogs } from "@/stores/useDialogStore"
import { addToQueue, playNext } from "@/player/controls"
import { setLiked } from "@/lib/actions"

/** Actions for the songs selected with Ctrl/Shift-click. */
export function SelectionBar() {
  const count = useSelectionStore((s) => s.ids.size)
  const clear = useSelectionStore((s) => s.clear)

  useEffect(() => {
    if (!count) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.closest("[role=dialog]"))) return
      if (e.key === "Escape") clear()
      if (e.key.toLowerCase() === "t" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        dialogs().openTags(useSelectionStore.getState().selected())
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [count, clear])

  if (!count) return null
  const songs = () => useSelectionStore.getState().selected()
  return (
    <div role="toolbar" aria-label="Selected songs" className="absolute bottom-4 left-1/2 z-toast flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-popover p-1.5 pl-4 text-popover-foreground shadow-2xl">
      <span className="mr-2 text-sm font-medium tabular-nums">{count} selected</span>
      <Button size="sm" className="rounded-full" onClick={() => dialogs().openTags(songs())}>
        <Tags /> Tag… <kbd className="ml-1 rounded bg-primary-foreground/20 px-1 text-xs">T</kbd>
      </Button>
      <Button size="sm" variant="ghost" className="rounded-full" onClick={() => dialogs().openAddToPlaylist(songs())}>
        <ListPlus /> Add to playlist
      </Button>
      <Button size="sm" variant="ghost" className="rounded-full" onClick={() => playNext(songs())}>
        <ListStart /> Play next
      </Button>
      <Button size="sm" variant="ghost" className="rounded-full" onClick={() => addToQueue(songs())}>
        <ListEnd /> Queue
      </Button>
      <Button size="sm" variant="ghost" className="rounded-full" onClick={() => songs().forEach((s) => void setLiked(s.id, true))}>
        <Heart /> Like
      </Button>
      <Button size="icon-sm" variant="ghost" className="rounded-full" aria-label="Clear selection (Esc)" title="Clear selection (Esc)" onClick={clear}>
        <X />
      </Button>
    </div>
  )
}
