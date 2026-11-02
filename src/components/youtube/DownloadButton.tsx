import { Check, Download, Loader2, RotateCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDownloadStore, isActive } from "@/stores/useDownloadStore"
import { enqueueVideos } from "./downloadActions"
import { cn } from "@/lib/utils"

/** Download / progress / done / retry for one video, driven by the main-process queue. */
export function DownloadButton({ videoId, title, owned, size = "sm", className }: { videoId: string; title: string; owned?: boolean; size?: "sm" | "default"; className?: string }) {
  const item = useDownloadStore((s) => s.byId[videoId])
  const active = isActive(item)
  if (active)
    return (
      <Button size={size} variant="secondary" className={cn("min-w-28 tabular-nums", className)} onClick={() => window.api.youtube.cancel(videoId)} title="Cancel">
        {item.status === "queued" ? (
          <>
            <Loader2 className="animate-spin" /> Queued
          </>
        ) : (
          <>
            <Loader2 className="animate-spin" /> {Math.round(item.percent)}% <X className="opacity-60" />
          </>
        )}
      </Button>
    )
  if (item?.status === "done" || item?.status === "skipped" || owned)
    return (
      <Button size={size} variant="ghost" disabled className={cn("min-w-28 text-success", className)}>
        <Check /> {item?.status === "done" ? "Saved" : "In library"}
      </Button>
    )
  if (item?.status === "error")
    return (
      <Button size={size} variant="muted_destructive" className={cn("min-w-28", className)} title={item.error?.message} onClick={() => enqueueVideos([{ videoId, title }])}>
        <RotateCw /> Retry
      </Button>
    )
  return (
    <Button size={size} variant="youtube" className={cn("min-w-28", className)} onClick={() => enqueueVideos([{ videoId, title }])}>
      <Download /> Download
    </Button>
  )
}
