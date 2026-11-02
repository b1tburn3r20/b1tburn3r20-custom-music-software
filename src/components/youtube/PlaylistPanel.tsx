import { useMemo, useState } from "react"
import { Check, ChevronDown, Download, ListMusic } from "lucide-react"
import { Artwork } from "@/components/base/Artwork"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { formatDuration } from "@/utils/textUtils"
import { useDownloadStore, isActive } from "@/stores/useDownloadStore"
import { navigate } from "@/stores/useAppStore"
import { cn } from "@/lib/utils"
import type { YtVideo } from "@/lib/youtubeApi"
import { DownloadButton } from "./DownloadButton"
import { enqueueVideos } from "./downloadActions"
import { useOwnedIndex } from "./useOwned"
import { toast } from "sonner"

type Props = {
  id: string
  title: string
  subtitle?: string
  thumbnail?: string | null
  /** Videos, or a loader that fetches them when the panel is opened. */
  videos?: YtVideo[]
  load?: () => Promise<YtVideo[]>
  defaultOpen?: boolean
}

/** One YouTube playlist: expand to see videos, pick some or all, download, optionally mirror as a local playlist. */
export function PlaylistPanel({ id, title, subtitle, thumbnail, videos: initial, load, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [videos, setVideos] = useState<YtVideo[] | null>(initial ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [mirror, setMirror] = useState(true)
  const owned = useOwnedIndex()
  const downloads = useDownloadStore((s) => s.byId)

  const ensureLoaded = async () => {
    if (videos || !load || loading) return
    setLoading(true)
    setError(null)
    try {
      setVideos(await load())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }
  const toggleOpen = () => {
    setOpen((o) => !o)
    if (!open) void ensureLoaded()
  }

  const available = useMemo(() => (videos ?? []).filter((v) => !v.unavailable), [videos])
  const missing = useMemo(() => available.filter((v) => !owned(v.id, v.title)?.exact), [available, owned])
  const activeCount = available.filter((v) => isActive(downloads[v.id])).length

  const download = async (list: YtVideo[]) => {
    if (!list.length) return
    const res = await enqueueVideos(
      list.map((v) => ({ videoId: v.id, title: v.title })),
      mirror ? { mirror: { youtubeId: id, title } } : undefined,
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

  return (
    <div className="rounded-xl border border-border/60 bg-card">
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
        <ChevronDown className={cn("size-5 transition-transform duration-normal", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-border/60 p-3">
          {loading && <p className="py-6 text-center text-sm text-muted-foreground">Loading videos…</p>}
          {error && <p role="alert" className="py-2 text-sm text-destructive">{error}</p>}
          {videos && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <Button size="sm" variant="youtube" disabled={!(mirror ? available : missing).length} onClick={downloadAll}>
                  <Download /> {mirror ? `Download all (${missing.length} new)` : `Download ${missing.length} missing`}
                </Button>
                <Button size="sm" variant="secondary" disabled={!selected.size} onClick={() => download(available.filter((v) => selected.has(v.id)))}>
                  <Download /> Download selected ({selected.size})
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  <Switch id={`mirror-${id}`} checked={mirror} onCheckedChange={setMirror} />
                  <Label htmlFor={`mirror-${id}`} className="text-sm">Also save as a local playlist</Label>
                </div>
              </div>
              <div className="flex flex-col">
                {videos.map((v, i) => {
                  const own = owned(v.id, v.title)
                  const sel = selected.has(v.id)
                  return (
                    <div key={`${v.id}-${i}`} className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5", i % 2 === 0 && "bg-muted/40", v.unavailable && "opacity-50")}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={sel}
                        aria-label={`Select ${v.title}`}
                        disabled={v.unavailable}
                        onClick={() =>
                          setSelected((p) => {
                            const n = new Set(p)
                            if (n.has(v.id)) n.delete(v.id)
                            else n.add(v.id)
                            return n
                          })
                        }
                        className={cn("flex size-5 shrink-0 items-center justify-center rounded border-2", sel ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50")}
                      >
                        {sel && <Check className="size-3" />}
                      </button>
                      <Artwork src={v.thumbnail} size="sm" />
                      <div className="min-w-0 flex-1 text-sm">
                        <p className={cn("truncate", own?.exact && "text-success", own && !own.exact && "text-warning")} title={v.title}>
                          {v.title}
                        </p>
                        <p className="truncate text-muted-foreground">{v.unavailable ? "Unavailable (private or deleted)" : v.channel}</p>
                      </div>
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{formatDuration(v.duration)}</span>
                      {!v.unavailable && <DownloadButton videoId={v.id} title={v.title} owned={own?.exact} />}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
