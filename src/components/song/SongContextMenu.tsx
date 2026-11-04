// Gives anything that represents a library song (e.g. a YouTube result you
// already own) the same right-click / "⋯" menu as a SongRow.
import { useState } from "react"
import { MoreHorizontal } from "lucide-react"
import type { Song } from "@/types/DirectoryTypes"
import { cn } from "@/lib/utils"
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MenuEntries } from "./menu"
import { useSongMenu, type SongContext } from "./useSongMenu"

/** Right-click menu around `children` (a single element that accepts a ref). */
export function SongContextMenu({ song, ctx, children }: { song: Song; ctx: SongContext; children: React.ReactElement }) {
  const [used, setUsed] = useState(false)
  const entries = useSongMenu(song, ctx, used)
  return (
    <ContextMenu onOpenChange={(o) => o && setUsed(true)}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <MenuEntries entries={entries} kind="context" />
      </ContextMenuContent>
    </ContextMenu>
  )
}

/** "⋯" button with the song menu. */
export function SongMoreButton({ song, ctx, className }: { song: Song; ctx: SongContext; className?: string }) {
  const [open, setOpen] = useState(false)
  const [used, setUsed] = useState(false)
  const entries = useSongMenu(song, ctx, used || open)
  return (
    <DropdownMenu
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setUsed(true)
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`More actions for ${song.metadata.title}`}
          onClick={(e) => e.stopPropagation()}
          className={cn("shrink-0 rounded-full p-2 text-muted-foreground outline-none hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", className)}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60" onClick={(e) => e.stopPropagation()}>
        <MenuEntries entries={entries} kind="dropdown" />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
