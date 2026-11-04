// The one song component used everywhere a song appears.
import { memo, useMemo, useState } from "react"
import { MoreHorizontal, Pause, Play, Youtube, FileAudio, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Song } from "@/types/DirectoryTypes"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { useUserStore } from "@/stores/useUserStore"
import { useSelectionStore } from "@/stores/useSelectionStore"
import { dialogs } from "@/stores/useDialogStore"
import { navigate } from "@/stores/useAppStore"
import { addToQueue, playNext, togglePlay } from "@/player/controls"
import { setLiked } from "@/lib/actions"
import { songArtists } from "@/lib/catalog"
import { formatDuration } from "@/utils/textUtils"
import { openAlbumForSong, openArtist } from "@/utils/musicutils"
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import LottieViewer from "@/components/helpers/lottie-viewer"
import { Artwork } from "@/components/base/Artwork"
import { VirtualList } from "@/components/base/VirtualList"
import { MenuEntries } from "./menu"
import { playSongInContext, useSongMenu, type SongContext } from "./useSongMenu"

export type SongRowVariant = "row" | "card" | "tile" | "compact"

export type SongRowProps = SongContext & {
  song: Song
  variant?: SongRowVariant
  /** 0-based position, shown as a number in the "row" variant. */
  index?: number
  /** Override "is this the current song" (the queue compares queue entries, not songs). */
  isCurrent?: boolean
  /** Override what a click does (the queue jumps to the entry instead of replacing the queue). */
  onActivate?: () => void
  /** Selection mode (e.g. "Add songs" dialog): click toggles, no context menu. */
  selected?: boolean
  onToggleSelect?: () => void
  dimmed?: boolean
  className?: string
  /** Extra inline label after the artist line (e.g. "queued"). */
  badge?: string
  /** Leave the album line out of a "tile" for a denser grid. */
  hideAlbum?: boolean
  /** Show the song's tags as a quiet line under the artist (rows, compact and cards). */
  showTags?: boolean
}

function ArtistLinks({ song, onNavigate }: { song: Song; onNavigate?: () => void }) {
  const artists = songArtists(song)
  if (!artists.length) return <span>{song.metadata.artist || "Unknown artist"}</span>
  return (
    <>
      {artists.map((a, i) => (
        <span key={a}>
          <button
            type="button"
            className="inline hover:underline hover:text-foreground focus-visible:underline outline-none"
            onClick={(e) => {
              e.stopPropagation()
              onNavigate?.()
              openArtist(a)
            }}
          >
            {a}
          </button>
          {i < artists.length - 1 && ", "}
        </span>
      ))}
    </>
  )
}

function AlbumLink({ song, onNavigate }: { song: Song; onNavigate?: () => void }) {
  if (!song.metadata.album) return null
  return (
    <button
      type="button"
      className="inline hover:underline hover:text-foreground focus-visible:underline outline-none"
      onClick={(e) => {
        e.stopPropagation()
        onNavigate?.()
        openAlbumForSong(song.id)
      }}
    >
      {song.metadata.album}
    </button>
  )
}

function SourceBadge({ song }: { song: Song }) {
  const yt = Boolean(song.sourceId)
  const Icon = yt ? Youtube : FileAudio
  return (
    <span title={yt ? `Downloaded from YouTube (${song.sourceId})` : song.name} className="inline-flex items-center gap-1 rounded-sm bg-muted px-1 text-2xs uppercase tracking-wide text-muted-foreground">
      <Icon className="size-3" aria-hidden /> {yt ? "YouTube" : "File"}
    </span>
  )
}

function PlayStateIcon({ current, playing, hovered }: { current: boolean; playing: boolean; hovered: boolean }) {
  if (current && playing && !hovered) return <LottieViewer />
  if (current && playing) return <Pause className="size-4 fill-current" />
  return <Play className={cn("size-4", current && "fill-current")} />
}

/**
 * ↑/↓ (and Home/End) between song rows: the rows of the same surface (page, queue,
 * dialog, search popup) in on-screen order. Returns the newly focused row.
 */
function moveRowFocus(from: HTMLElement, step: number): HTMLElement | null {
  const scope = from.closest("[role=dialog],[data-queue],#search-suggestions,[data-radix-scroll-area-viewport]") ?? document.body
  const rows = [...scope.querySelectorAll<HTMLElement>("[data-song-row]")]
  const i = rows.indexOf(from)
  const to = step === -Infinity ? rows[0] : step === Infinity ? rows[rows.length - 1] : rows[i + step]
  if (!to) return null
  to.focus({ preventScroll: true })
  to.scrollIntoView({ block: "nearest" })
  return to
}

export const SongRow = memo(function SongRow(props: SongRowProps) {
  const { song, variant = "row", index, onActivate, selected, onToggleSelect, dimmed, className, badge, hideAlbum, showTags, ...ctx } = props
  const storeCurrent = usePlayerStore((s) => s.currentSongId === song.id)
  const isCurrent = props.isCurrent ?? storeCurrent
  const storePlaying = usePlayerStore((s) => s.currentSongId === song.id && !s.paused)
  const globalPlaying = usePlayerStore((s) => (props.isCurrent !== undefined ? !s.paused : false))
  const isPlaying = isCurrent && (props.isCurrent !== undefined ? globalPlaying : storePlaying)
  const duplicateTitle = useLibraryStore((s) => (s.titleCounts.get(song.metadata.title.trim().toLowerCase()) ?? 0) > 1)
  const tags = useUserStore((s) => s.songTags[song.id])
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  // Build menu entries only after a menu was first opened (cheap rows in long
  // lists), then keep them so the close animation never shows an empty menu.
  const [menuUsed, setMenuUsed] = useState(false)
  const selectable = Boolean(onToggleSelect)
  const entries = useSongMenu(song, ctx, menuUsed || menuOpen)

  const isSelected = useSelectionStore((s) => s.ids.has(song.id) && (!ctx.list || s.list === ctx.list))
  const activate = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (selectable) return onToggleSelect?.()
    // Ctrl/Cmd-click toggles, Shift-click selects a range (multi-select for tagging etc.)
    if (e && ctx.list && index !== undefined && (e.ctrlKey || e.metaKey)) return useSelectionStore.getState().toggle(ctx.list, index)
    if (e && ctx.list && index !== undefined && e.shiftKey) return useSelectionStore.getState().range(ctx.list, index)
    if (useSelectionStore.getState().ids.size) useSelectionStore.getState().clear()
    if (onActivate) return onActivate()
    if (isCurrent) return togglePlay()
    playSongInContext(song, ctx)
  }
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return // keys on the row's own buttons (⋯, artist links) are theirs
    const stop = () => {
      e.preventDefault()
      e.stopPropagation()
    }
    const mod = e.ctrlKey || e.metaKey || e.altKey
    const key = e.key
    if (key === "Enter" || key === " ") {
      stop()
      // Shift/Ctrl+Enter would extend the selection; plain Enter plays.
      activate(key === " " ? undefined : e)
      return
    }
    const step = key === "ArrowDown" || (variant === "tile" && key === "ArrowRight") ? 1 : key === "ArrowUp" || (variant === "tile" && key === "ArrowLeft") ? -1 : 0
    if ((step || key === "Home" || key === "End") && !mod) {
      stop()
      const target = moveRowFocus(e.currentTarget, step || (key === "Home" ? -Infinity : Infinity))
      // Shift+↑/↓ selects as you go (like Shift-click).
      if (e.shiftKey && step && ctx.list && index !== undefined && !selectable) {
        const sel = useSelectionStore.getState()
        const to = index + step
        if (to >= 0 && to < ctx.list.length && target) {
          if (sel.list !== ctx.list || !sel.ids.has(song.id)) sel.toggle(ctx.list, index)
          useSelectionStore.getState().range(ctx.list, to)
        }
      }
      return
    }
    if (key === "ContextMenu" || (key === "F10" && e.shiftKey)) {
      // Open the right-click menu at the row (Radix positions it from the pointer coords).
      stop()
      const r = e.currentTarget.getBoundingClientRect()
      e.currentTarget.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 48, clientY: r.top + r.height / 2 }))
      return
    }
    if (mod || selectable || e.repeat) return
    const k = key.toLowerCase()
    if (k === "t" && !useSelectionStore.getState().ids.size) {
      // T on a focused song: edit its tags (with a selection, the selection bar tags all of them)
      stop()
      dialogs().openTags([song])
    } else if (k === "l") {
      stop()
      void setLiked(song.id, !useUserStore.getState().likedIds.has(song.id))
    } else if (k === "q") {
      stop()
      addToQueue([song])
    } else if (k === "n") {
      stop()
      playNext([song])
    }
  }

  const title = (
    <span className={cn("font-semibold truncate", isCurrent && "text-primary")} title={song.metadata.title}>
      {song.metadata.title}
    </span>
  )
  const meta = song.metadata
  const showAlbumLine = !hideAlbum && (variant !== "compact" || duplicateTitle)

  const moreButton = !selectable && (
    <DropdownMenu open={menuOpen} onOpenChange={(o) => { setMenuOpen(o); if (o) setMenuUsed(true) }}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`More actions for ${meta.title}`}
          onClick={(e) => e.stopPropagation()}
          className={cn("shrink-0 rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-accent/60 outline-none focus-visible:ring-2 focus-visible:ring-ring transition-opacity", hovered || menuOpen ? "opacity-100" : "opacity-0 focus-visible:opacity-100")}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60" onClick={(e) => e.stopPropagation()}>
        <MenuEntries entries={entries} kind="dropdown" />
      </DropdownMenuContent>
    </DropdownMenu>
  )

  let body: React.ReactNode
  if (variant === "tile") {
    body = (
      <div className="flex flex-col gap-2 p-3">
        <div className="relative">
          <Artwork src={meta.thumbnail} size="fill" />
          <div className={cn("absolute inset-0 flex items-center justify-center rounded-lg transition-[opacity,background-color] duration-normal", hovered ? "bg-background/40 opacity-100" : isCurrent ? "opacity-100" : "opacity-0")}>
            {/* While playing (not hovered) only a faint tint behind the animation; the solid button appears on hover. */}
            <span className={cn("flex size-12 items-center justify-center rounded-full transition-colors duration-normal [&>div]:size-8", hovered ? "bg-primary text-primary-foreground shadow-lg" : "bg-primary/5 text-primary")}>
              <PlayStateIcon current={isCurrent} playing={isPlaying} hovered={hovered} />
            </span>
          </div>
        </div>
        <div className="flex flex-col min-w-0 text-sm">
          {title}
          <span className="text-muted-foreground truncate">
            <ArtistLinks song={song} onNavigate={ctx.onNavigate} />
          </span>
          {showAlbumLine && meta.album && (
            <span className="text-muted-foreground/70 truncate">
              <AlbumLink song={song} onNavigate={ctx.onNavigate} />
              {meta.year ? ` · ${meta.year}` : ""}
            </span>
          )}
        </div>
      </div>
    )
  } else {
    const artSize = variant === "card" ? "md" : variant === "compact" ? "sm" : "sm"
    body = (
      <div className={cn("flex items-center gap-3 px-3", variant === "compact" ? "py-1.5" : "py-2")}>
        {variant === "row" && (
          <div className="w-8 shrink-0 flex justify-center text-sm tabular-nums text-muted-foreground">
            {selectable ? (
              <span className={cn("size-5 rounded border-2 flex items-center justify-center", selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/50")}>
                {selected && <Check className="size-3" />}
              </span>
            ) : hovered || (isCurrent && isPlaying) ? (
              <PlayStateIcon current={isCurrent} playing={isPlaying} hovered={hovered} />
            ) : (
              <span className={cn(isCurrent && "text-primary")}>{index !== undefined ? index + 1 : ""}</span>
            )}
          </div>
        )}
        <div className="relative">
          <Artwork src={meta.thumbnail} size={artSize} />
          {variant !== "row" && (
            <div className={cn("absolute inset-0 flex items-center justify-center rounded-md bg-background/50 transition-opacity", hovered || (isCurrent && isPlaying) ? "opacity-100" : "opacity-0")}>
              {selectable ? selected && <Check className="size-5" /> : <PlayStateIcon current={isCurrent} playing={isPlaying} hovered={hovered} />}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col text-sm">
          <span className="flex items-center gap-2 min-w-0">
            {title}
            {duplicateTitle && <SourceBadge song={song} />}
          </span>
          <span className="text-muted-foreground truncate">
            <ArtistLinks song={song} onNavigate={ctx.onNavigate} />
            {variant === "row" && meta.album && (
              <>
                <span aria-hidden> · </span>
                <AlbumLink song={song} onNavigate={ctx.onNavigate} />
              </>
            )}
            {badge && <span className="ml-2 text-xs uppercase tracking-wide">· {badge}</span>}
          </span>
          {variant === "card" && showAlbumLine && meta.album && (
            <span className="text-muted-foreground/70 truncate">
              <AlbumLink song={song} onNavigate={ctx.onNavigate} />
              {meta.year ? ` · ${meta.year}` : ""}
            </span>
          )}
          {variant === "compact" && duplicateTitle && meta.album && <span className="text-muted-foreground/70 truncate text-xs">{meta.album}</span>}
          {showTags && (
            <span className="truncate text-xs text-muted-foreground/60" title={tags?.join(", ")}>
              {tags?.length ? tags.join(" · ") : <span className="italic opacity-70">no tags</span>}
            </span>
          )}
        </div>
        {variant === "row" && tags && tags.length > 0 && (
          <span className="hidden shrink-0 items-center gap-1 lg:flex">
            {tags.slice(0, 3).map((t) => (
              <button
                key={t}
                type="button"
                title={`Open the “${t}” mix`}
                onClick={(e) => {
                  e.stopPropagation()
                  navigate({ name: "tag", tag: t })
                }}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-muted-foreground hover:bg-primary/20 hover:text-foreground"
              >
                {t}
              </button>
            ))}
            {tags.length > 3 && <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>}
          </span>
        )}
        {(variant === "row" || duplicateTitle) && <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{formatDuration(meta.duration)}</span>}
        {moreButton}
      </div>
    )
  }

  const row = (
    <div
      role={selectable ? "checkbox" : "button"}
      aria-checked={selectable ? Boolean(selected) : undefined}
      aria-current={isCurrent ? "true" : undefined}
      data-song-row
      aria-label={`${meta.title} by ${meta.artist}`}
      tabIndex={0}
      onClick={(e) => activate(e)}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative select-none cursor-pointer rounded-lg outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring",
        isCurrent && "bg-accent/20",
        (selected || isSelected) && "bg-primary/15 ring-1 ring-primary/40",
        dimmed && "opacity-50",
        className,
      )}
    >
      {body}
    </div>
  )

  if (selectable) return row
  return (
    <ContextMenu onOpenChange={(o) => o && setMenuUsed(true)}>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <MenuEntries entries={entries} kind="context" />
      </ContextMenuContent>
    </ContextMenu>
  )
})

const ROW_HEIGHT = { row: 56, compact: 52, card: 72, tile: 240 } as const

/** A list of songs where each row plays the list from that song. Long lists are virtualized. */
export function SongList({ songs, variant = "row", className, ...ctx }: { songs: readonly Song[]; variant?: SongRowVariant; className?: string } & Omit<SongContext, "list">) {
  // A playlist can hold the same song twice: keys must still be unique.
  const keys = useMemo(() => {
    const seen = new Map<string, number>()
    return songs.map((s) => {
      const n = seen.get(s.id) ?? 0
      seen.set(s.id, n + 1)
      return n ? `${s.id}#${n}` : s.id
    })
  }, [songs])
  return (
    <VirtualList
      items={songs}
      getKey={(_, i) => keys[i]}
      estimateSize={ROW_HEIGHT[variant]}
      className={className}
      renderItem={(s, i) => <SongRow song={s} index={i} variant={variant} list={songs} {...ctx} />}
    />
  )
}
