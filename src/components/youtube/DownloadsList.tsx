import { useMemo } from "react"
import { CheckCircle2, CircleSlash, Download, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/base/Page"
import { useDownloadStore, isActive } from "@/stores/useDownloadStore"
import { call } from "@/lib/api"
import type { DownloadItem } from "@/types/api"
import { VirtualList } from "@/components/base/VirtualList"
import { cn } from "@/lib/utils"
import { AuthBanner } from "./AuthBanner"
import { isAuthError } from "./downloadActions"

export function DownloadsList() {
  const byId = useDownloadStore((s) => s.byId)
  const items = useMemo(() => Object.values(byId).sort((a, b) => b.addedAt - a.addedAt), [byId])
  const authError = items.find((i) => i.status === "error" && isAuthError(i.error?.code))
  const fellBack = !authError && items.some((i) => i.note?.includes("without sign-in"))
  const active = items.filter(isActive).length
  if (!items.length) return <EmptyState icon={Download} title="No downloads yet" hint="Downloads from search results and playlists show up here." />
  return (
    <div className="flex flex-col gap-3">
      {authError?.error && <AuthBanner code={authError.error.code} message={authError.error.message} />}
      {fellBack && <AuthBanner code="YTDLP_JS_CHALLENGE" message="Some songs were downloaded without your YouTube sign-in, because yt-dlp couldn't solve YouTube's JavaScript challenge." />}
      <div className="flex items-center gap-2">
        <p className="flex-1 text-sm text-muted-foreground">{active ? `${active} in progress` : "All done"}</p>
        {active > 0 && (
          <Button size="sm" variant="secondary" onClick={() => window.api.youtube.cancel()}>
            Cancel all
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={async () => useDownloadStore.getState().set(await call(window.api.youtube.clearFinished()))}>
          Clear finished
        </Button>
      </div>
      <div className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card">
        <VirtualList items={items} getKey={(i) => i.videoId} estimateSize={53} renderItem={(i, n) => <DownloadRow item={i} first={n === 0} />} />
      </div>
    </div>
  )
}

function DownloadRow({ item: i, first }: { item: DownloadItem; first: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2 text-sm", !first && "border-t border-border/60")}>
      {i.status === "done" || i.status === "skipped" ? (
        <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="done" />
      ) : i.status === "error" ? (
        <XCircle className="size-4 shrink-0 text-destructive" aria-label="failed" />
      ) : i.status === "cancelled" ? (
        <CircleSlash className="size-4 shrink-0 text-muted-foreground" aria-label="cancelled" />
      ) : (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-label="in progress" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate" title={i.title}>{i.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {i.status === "downloading" && (i.note === "finishing…" ? "Finishing — waiting for earlier downloads to keep the order" : `${Math.round(i.percent)}%`)}
          {i.status === "queued" && "Waiting…"}
          {i.status === "done" && (i.note === "downloaded without sign-in" ? "Saved to your library (downloaded without sign-in — see the notice above)" : "Saved to your library")}
          {i.status === "skipped" && (i.note === "matched title, artist and length" ? "Already in your library (matched title, artist and length)" : "Already in your library")}
          {i.status === "cancelled" && "Cancelled"}
          {i.status === "error" && i.error?.message}
        </p>
      </div>
      {isActive(i) && (
        <Button size="sm" variant="ghost" onClick={() => window.api.youtube.cancel(i.videoId)}>
          Cancel
        </Button>
      )}
    </div>
  )
}
