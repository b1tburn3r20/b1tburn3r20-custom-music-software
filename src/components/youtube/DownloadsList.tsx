import { useMemo } from "react"
import { CheckCircle2, CircleSlash, Download, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/base/Page"
import { useDownloadStore, isActive } from "@/stores/useDownloadStore"
import { call } from "@/lib/api"
import { AuthBanner } from "./AuthBanner"
import { isAuthError } from "./downloadActions"

export function DownloadsList() {
  const byId = useDownloadStore((s) => s.byId)
  const items = useMemo(() => Object.values(byId).sort((a, b) => b.addedAt - a.addedAt), [byId])
  const authError = items.find((i) => i.status === "error" && isAuthError(i.error?.code))
  const active = items.filter(isActive).length
  if (!items.length) return <EmptyState icon={Download} title="No downloads yet" hint="Downloads from search results and playlists show up here." />
  return (
    <div className="flex flex-col gap-3">
      {authError?.error && <AuthBanner code={authError.error.code} message={authError.error.message} />}
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
      <ul className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
        {items.map((i) => (
          <li key={i.videoId} className="flex items-center gap-3 px-3 py-2 text-sm">
            {i.status === "done" || i.status === "skipped" ? (
              <CheckCircle2 className="size-4 text-success" aria-label="done" />
            ) : i.status === "error" ? (
              <XCircle className="size-4 text-destructive" aria-label="failed" />
            ) : i.status === "cancelled" ? (
              <CircleSlash className="size-4 text-muted-foreground" aria-label="cancelled" />
            ) : (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="in progress" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate">{i.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {i.status === "downloading" && `${Math.round(i.percent)}%`}
                {i.status === "queued" && "Waiting…"}
                {i.status === "done" && "Saved to your library"}
                {i.status === "skipped" && (i.note === "matched by title" ? "Already in your library (matched by title)" : "Already in your library")}
                {i.status === "cancelled" && "Cancelled"}
                {i.status === "error" && i.error?.message}
              </p>
            </div>
            {isActive(i) && (
              <Button size="sm" variant="ghost" onClick={() => window.api.youtube.cancel(i.videoId)}>
                Cancel
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
