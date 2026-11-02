// The one song component used everywhere a song appears.
import { memo, useState } from "react"
import { MoreHorizontal, Pause, Play, Youtube, FileAudio, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Song } from "@/types/DirectoryTypes"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { togglePlay } from "@/player/controls"
import { songArtists } from "@/lib/catalog"
import { formatDuration } from "@/utils/textUtils"
import { openAlbumForSong, openArtist } from "@/utils/musicutils"
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import LottieViewer from "@/components/helpers/lottie-viewer"
import { Artwork } from "@/components/base/Artwork"
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
            className="hover:underline hover:text-foreground focus-visible:underline outline-none"
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
      className="hover:underline hover:text-foreground focus-visible:underline outline-none truncate"
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

export const SongRow = memo(function SongRow(props: SongRowProps) {
  const { song, variant = "row", index, onActivate, selected, onToggleSelect, dimmed, className, badge, ...ctx } = props
  const storeCurrent = usePlayerStore((s) => s.currentSongId === song.id)
  const isCurrent = props.isCurrent ?? storeCurrent
  const storePlaying = usePlayerStore((s) => s.currentSongId === song.id && !s.paused)
  const globalPlaying = usePlayerStore((s) => (props.isCurrent !== undefined ? !s.paused : false))
  const isPlaying = isCurrent && (props.isCurrent !== undefined ? globalPlaying : storePlaying)
  const duplicateTitle = useLibraryStore((s) => (s.titleCounts.get(song.metadata.title.trim().toLowerCase()) ?? 0) > 1)
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  // Build menu entries only after a menu was first opened (cheap rows in long
  // lists), then keep them so the close animation never shows an empty menu.
  const [menuUsed, setMenuUsed] = useState(false)
  const selectable = Boolean(onToggleSelect)
  const entries = useSongMenu(song, ctx, menuUsed || menuOpen)

  const activate = () => {
    if (selectable) return onToggleSelect?.()
    if (onActivate) return onActivate()
    if (isCurrent) return togglePlay()
    playSongInContext(song, ctx)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      e.stopPropagation()
      activate()
    }
  }

  const title = (
    <span className={cn("font-semibold truncate", isCurrent && "text-primary")} title={song.metadata.title}>
      {song.metadata.title}
    </span>
  )
  const meta = song.metadata
  const showAlbumLine = variant !== "compact" || duplicateTitle

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
          <div className={cn("absolute inset-0 flex items-center justify-center rounded-lg bg-background/40 transition-opacity", hovered || isCurrent ? "opacity-100" : "opacity-0")}>
            <span className="rounded-full bg-primary p-3 text-primary-foreground shadow-lg">
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
        </div>
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
      aria-label={`${meta.title} by ${meta.artist}`}
      tabIndex={0}
      onClick={activate}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative select-none cursor-pointer rounded-lg outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring",
        isCurrent && "bg-accent/20",
        selected && "bg-accent/30",
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

/** A list of songs where each row plays the list from that song. */
export function SongList({ songs, variant = "row", className, ...ctx }: { songs: readonly Song[]; variant?: SongRowVariant; className?: string } & Omit<SongContext, "list">) {
  return (
    <div className={cn("flex flex-col", className)}>
      {songs.map((s, i) => (
        <SongRow key={s.id} song={s} index={i} variant={variant} list={songs} {...ctx} />
      ))}
    </div>
  )
}
