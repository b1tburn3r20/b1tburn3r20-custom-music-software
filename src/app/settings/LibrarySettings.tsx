import { useState } from "react"
import { Loader2, SearchCheck, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/base/Layout"
import ChangeRootDir from "@/components/Folders/ChangeRootDir"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { call, errorMessage } from "@/lib/api"
import type { OrphanReport } from "@/types/api"
import { toast } from "sonner"

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`

/** Dry-run first, then clean up only what the user confirms. Missing files are never assumed gone for good. */
function CleanupCard() {
  const [report, setReport] = useState<OrphanReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [forgetMissing, setForgetMissing] = useState(false)

  const scan = async () => {
    setBusy(true)
    try {
      setReport(await call(window.api.library.orphanReport()))
    } catch (e) {
      toast.error("Couldn't check the library", { description: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }
  const clean = async () => {
    if (!report) return
    setBusy(true)
    try {
      const r = await call(window.api.library.orphanCleanup({ thumbnails: true, dangling: true, missingIds: forgetMissing ? report.missing.map((m) => m.id) : [] }))
      toast.success("Library cleaned up", { description: `${r.thumbsRemoved} unused artwork files, ${r.refsRemoved} broken references${r.forgotten ? `, ${r.forgotten} missing songs forgotten` : ""}.` })
      setReport(await call(window.api.library.orphanReport()))
      setForgetMissing(false)
    } catch (e) {
      toast.error("Cleanup failed", { description: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }
  const nothing = report && !report.orphanThumbnails && !report.danglingReferences && !report.missing.length

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm font-medium">Clean up leftovers</p>
        <Button size="sm" variant="secondary" onClick={scan} disabled={busy}>
          {busy && !report ? <Loader2 className="animate-spin" /> : <SearchCheck />} Check
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Finds unused cached artwork, playlist/like/history entries pointing at deleted songs, and songs whose files are missing. Nothing is removed until you confirm.</p>
      {report && (
        <div className="flex flex-col gap-2 text-sm">
          {nothing ? (
            <p className="text-success">Everything is tidy.</p>
          ) : (
            <ul className="list-inside list-disc text-muted-foreground">
              <li>{report.orphanThumbnails} unused artwork files ({mb(report.orphanThumbnailBytes)})</li>
              <li>{report.danglingReferences} references to songs that no longer exist</li>
              <li>{report.missing.length} songs whose files are missing</li>
            </ul>
          )}
          {report.missing.length > 0 && (
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" checked={forgetMissing} onChange={(e) => setForgetMissing(e.target.checked)} className="mt-0.5" />
              <span>
                Also forget the {report.missing.length} missing songs (only if the files are really gone — e.g. not on an unplugged drive). Examples: {report.missing.slice(0, 3).map((m) => m.title).join(", ")}
                {report.missing.length > 3 ? "…" : ""}
              </span>
            </label>
          )}
          {!nothing && (
            <Button size="sm" onClick={clean} disabled={busy} className="self-start">
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Clean up
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}

export default function LibrarySettings() {
  const count = useLibraryStore((s) => s.songs.length)
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-sm text-muted-foreground">Songs in library</p>
        <p className="text-2xl font-bold">{count}</p>
      </Card>
      <Card className="flex flex-col gap-2">
        <p className="text-sm font-medium">Music folder</p>
        <ChangeRootDir />
      </Card>
      <CleanupCard />
      <Card className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Error logs</p>
          <p className="text-xs text-muted-foreground">If something goes wrong, the details are saved here to help fix it. They stay on this computer.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void window.api.window.openLogs()}>
          Open log folder
        </Button>
      </Card>
    </div>
  )
}
