import { memo, useMemo, useState } from "react"
import { Check, ChevronDown, Download, ListMusic, Pause, Play, RefreshCcw } from "lucide-react"
import { Artwork } from "@/components/base/Artwork"
import { VirtualList } from "@/components/base/VirtualList"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { formatDuration } from "@/utils/textUtils"
import { useDownloadStore, isActive } from "@/stores/useDownloadStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { dialogs } from "@/stores/useDialogStore"
import { navigate } from "@/stores/useAppStore"
import { playContext, playFromList, togglePlay } from "@/player/controls"
import type { QueueContext } from "@/player/queue"
import { cn } from "@/lib/utils"
import type { YtVideo } from "@/lib/youtubeApi"
import { VideoRowsSkeleton } from "./Skeletons"
import type { Song } from "@/types/DirectoryTypes"
import { SongContextMenu, SongMoreButton } from "@/components/song/SongContextMenu"
import type { EnqueueOpts } from "./downloadActions"
import { DownloadButton } from "./DownloadButton"
import { enqueueVideos } from "./downloadActions"
import { useOwnedIndex } from "./useOwned"
import { toast } from "sonner"

type Props = {
  id: string
  title: string
  subtitle?: string
  thumbnail?: string | null
  /** The playlist's videos (null = not loaded yet). */
  videos: YtVideo[] | null
  loading?: boolean
  error?: string | null
  /** Controlled open state; omit to manage it internally (starting at `defaultOpen`). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  /** Shown as a "Resync" button inside the open panel. */
  onRefresh?: () => void
}

/** One YouTube playlist: expand to see videos, pick some or all, download, optionally mirror as a local playlist. Songs you own play like any other list. */
export function PlaylistPanel({ id, title, subtitle, thumbnail, videos, loading = false, error = null, open: openProp, onOpenChange, defaultOpen = false, onRefresh }: Props) {
  const [openState, setOpenState] = useState(defaultOpen)
  const open = openProp ?? openState
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [mirror, setMirror] = useState(true)
  const owned = useOwnedIndex()
  const downloads = useDownloadStore((s) => s.byId)

  const toggleOpen = () => {
    setOpenState(!open)
    onOpenChange?.(!open)
  }

  const available = useMemo(() => (videos ?? []).filter((v) => !v.unavailable), [videos])
  const ownedByVideo = useMemo(() => (videos ?? []).map((v) => (v.unavailable ? null : owned(v)?.song ?? null)), [videos, owned])
  const missing = useMemo(() => (videos ?? []).filter((v, i) => !v.unavailable && !ownedByVideo[i]), [ownedByVideo, videos])
  // The songs you already have, in playlist order: clicking one plays this list from there.
  const ownedSongs = useMemo(() => {
    const seen = new Set<string>()
    return ownedByVideo.filter((s): s is Song => Boolean(s) && !seen.has(s!.id) && Boolean(seen.add(s!.id)))
  }, [ownedByVideo])
  const queueContext = useMemo<QueueContext>(() => ({ type: "list", id: `yt:${id}`, label: title }), [id, title])
  const activeCount = available.filter((v) => isActive(downloads[v.id])).length
  const mirrorOpts: EnqueueOpts | undefined = mirror ? { mirror: { youtubeId: id, title } } : undefined

  const download = async (list: YtVideo[]) => {
    if (!list.length) return
    const res = await enqueueVideos(
      list.map((v) => ({ videoId: v.id, title: v.title, channel: v.channel, duration: v.duration, index: (videos ?? []).indexOf(v) })),
      mirrorOpts,
    )
    if (res) {
      const skipped = res.items.filter((i) => i.status === "skipped").length
      toast.success(`Queued ${list.length - skipped} download${list.length - skipped === 1 ? "" : "s"}`, {
        description: [skipped ? `${skipped} already in your library` : null, res.playlistId ? "Songs are added to a local playlist" : null].filter(Boolean).join(" · ") || undefined,
        action: res.playlistId ? { label: "Open playlist", onClick: () => navigate({ name: "playlist", id: res.playlistId! }) } : undefined,
      })
      setSelected(new Set())
    }
  }
  // Mirroring needs the whole playlist (including songs you already have), not just the missing ones.
  const downloadAll = () => download(mirror ? available : missing)
  const toggleSelect = (videoId: string) =>
    setSelected((p) => {
      const n = new Set(p)
      if (n.has(videoId)) n.delete(videoId)
      else n.add(videoId)
      return n
    })

  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-background-light">
      <button type="button" onClick={toggleOpen} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left">
        {thumbnail ? <Artwork src={thumbnail} size="md" /> : <span className="flex size-art-md items-center justify-center rounded-md bg-muted"><ListMusic className="size-6 text-muted-foreground" /></span>}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{title}</p>
          <p className="truncate text-sm text-muted-foreground">
            {subtitle}
            {videos && ` · ${available.length} videos · ${available.length - missing.length} in library`}
            {activeCount > 0 && ` · downloading ${activeCount}`}
          </p>
        </div>
        <ChevronDown className={cn("size-5 shrink-0 transition-transform duration-normal", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-border/60 p-3">
          {loading && !videos && <VideoRowsSkeleton />}
          {error && <p role="alert" className="py-2 text-sm text-destructive">{error}</p>}
          {videos && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <Button size="sm" variant="secondary" disabled={!ownedSongs.length} onClick={() => playContext(ownedSongs, 0, queueContext)} title="Play the songs from this playlist that are in your library">
                  <Play /> Play ({ownedSongs.length})
                </Button>
                <Button size="sm" variant="youtube" disabled={!(mirror ? available : missing).length} onClick={downloadAll}>
                  <Download /> {mirror ? `Download all (${missing.length} new)` : `Download ${missing.length} missing`}
                </Button>
                <Button size="sm" variant="secondary" disabled={!selected.size} onClick={() => download(available.filter((v) => selected.has(v.id)))}>
                  <Download /> Download selected ({selected.size})
                </Button>
                {onRefresh && (
                  <Button size="sm" variant="ghost" onClick={onRefresh} disabled={loading} title="Fetch this playlist from YouTube again">
                    <RefreshCcw className={loading ? "animate-spin" : ""} /> Resync
                  </Button>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <Switch id={`mirror-${id}`} checked={mirror} onCheckedChange={setMirror} />
                  <Label htmlFor={`mirror-${id}`} className="text-sm">Also save as a local playlist</Label>
                </div>
              </div>
              <VirtualList
                items={videos}
                getKey={(v, i) => `${v.id}-${i}`}
                estimateSize={52}
                renderItem={(v, i) => (
                  <VideoRow
                    video={v}
                    index={i}
                    song={ownedByVideo[i]}
                    list={ownedSongs}
                    queueContext={queueContext}
                    selected={selected.has(v.id)}
                    onToggleSelect={toggleSelect}
                    opts={mirrorOpts}
                  />
                )}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

type RowProps = {
  video: YtVideo
  index: number
  /** The library song for this video, if you have it. */
  song: Song | null
  list: readonly Song[]
  queueContext: QueueContext
  selected: boolean
  onToggleSelect: (videoId: string) => void
  opts?: EnqueueOpts
}

const VideoRow = memo(function VideoRow({ video: v, index: i, song, list, queueContext, selected, onToggleSelect, opts }: RowProps) {
  const isCurrent = usePlayerStore((s) => Boolean(song) && s.currentSongId === song?.id)
  const playing = usePlayerStore((s) => !s.paused) && isCurrent
  const play = () => {
    if (!song) return
    if (isCurrent) togglePlay()
    else playFromList(list, song, queueContext)
  }

  const row = (
    <div
      role={song ? "button" : undefined}
      tabIndex={song ? 0 : undefined}
      aria-current={isCurrent ? "true" : undefined}
      aria-label={song ? `${song.metadata.title} by ${song.metadata.artist}` : undefined}
      data-song-row={song ? "" : undefined}
      onClick={song ? play : undefined}
      onKeyDown={
        song
          ? (e) => {
              if (e.target !== e.currentTarget) return
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                play()
              } else if (e.key.toLowerCase() === "t" && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault()
                dialogs().openTags([song])
              }
            }
          : undefined
      }
      className={cn(
        "group flex items-center gap-3 rounded-lg px-2 py-1.5 outline-none",
        i % 2 === 0 && "bg-muted/40",
        v.unavailable && "opacity-50",
        song && "cursor-pointer hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring",
        isCurrent && "bg-accent/30",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={`Select ${v.title}`}
        disabled={v.unavailable}
        onClick={(e) => {
          e.stopPropagation()
          onToggleSelect(v.id)
        }}
        className={cn("flex size-5 shrink-0 items-center justify-center rounded border-2", selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50")}
      >
        {selected && <Check className="size-3" />}
      </button>
      <div className="relative shrink-0">
        <Artwork src={song?.metadata.thumbnail ?? v.thumbnail} size="sm" />
        {song && (
          <span className={cn("absolute inset-0 flex items-center justify-center rounded-md bg-background/50 transition-opacity", isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
            {playing ? <Pause className="size-4 fill-current" /> : <Play className={cn("size-4", isCurrent && "fill-current")} />}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className={cn("truncate", song && (isCurrent ? "font-semibold text-primary" : "text-success"))} title={v.title}>
          {v.title}
        </p>
        <p className="truncate text-muted-foreground">{v.unavailable ? "Unavailable (private or deleted)" : v.channel}</p>
      </div>
      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{formatDuration(v.duration)}</span>
      {!v.unavailable && (
        <span onClick={(e) => e.stopPropagation()} className="contents">
          <DownloadButton videoId={v.id} title={v.title} channel={v.channel} duration={v.duration} index={i} opts={opts} owned={Boolean(song)} />
        </span>
      )}
      {song ? <SongMoreButton song={song} ctx={{ list, queueContext }} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" /> : <span className="w-8 shrink-0" aria-hidden />}
    </div>
  )

  return song ? <SongContextMenu song={song} ctx={{ list, queueContext }}>{row}</SongContextMenu> : row
})
