// yt-dlp's update prompt. Updating only ever replaces the app's own copy of that one
// program, so it can never turn into a system upgrade.
import { useEffect } from "react"
import { create } from "zustand"
import { CheckCircle2, Download, Loader2, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/base/Layout"
import { call, errorMessage } from "@/lib/api"
import { updateSettings } from "@/lib/actions"
import { useUserStore } from "@/stores/useUserStore"
import type { YtDlpState } from "@/types/api"
import { toast } from "sonner"

const INITIAL: YtDlpState = { status: "idle", current: null, latest: null, source: null }
const BUSY = new Set<YtDlpState["status"]>(["checking", "downloading", "installing", "waiting"])

const useYtDlpStore = create<{ state: YtDlpState; dismissed: string | null }>(() => ({ state: INITIAL, dismissed: null }))

let subscribed = false
function useYtDlpState() {
  useEffect(() => {
    if (subscribed) return
    subscribed = true
    window.api.tools.onYtDlpState((state) => useYtDlpStore.setState({ state }))
    call(window.api.tools.ytDlpState())
      .then((state) => useYtDlpStore.setState({ state }))
      .catch((e) => console.warn("[yt-dlp] couldn't read update state:", e))
  }, [])
  return useYtDlpStore((s) => s.state)
}

async function runUpdate() {
  try {
    const state = await call(window.api.tools.updateYtDlp())
    if (state.status === "error") toast.error("yt-dlp wasn't updated", { description: state.error ?? undefined })
    else if (state.status === "up-to-date") toast.success(`yt-dlp is now ${state.current}`)
  } catch (e) {
    toast.error("yt-dlp wasn't updated", { description: errorMessage(e) })
  }
}

function actionLabel(state: YtDlpState) {
  if (state.status === "downloading") return state.percent != null ? `Downloading… ${state.percent}%` : "Downloading…"
  if (state.status === "waiting") return "Waiting for downloads to finish…"
  if (state.status === "installing") return "Installing…"
  if (state.source === "missing" || !state.current) return "Install yt-dlp"
  // A copy from a package manager is left alone; the app gets its own beside it.
  if (state.source === "path") return "Install a separate copy"
  return "Update yt-dlp"
}

export function UpdateYtDlpButton({ size = "sm" }: { size?: "sm" | "default" }) {
  const state = useYtDlpState()
  const busy = BUSY.has(state.status)
  return (
    <Button size={size} onClick={() => void runUpdate()} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <Download />} {actionLabel(state)}
    </Button>
  )
}

/** Non-blocking suggestion, shown when a newer yt-dlp exists. */
export function YtDlpUpdateBanner() {
  const state = useYtDlpState()
  const dismissed = useYtDlpStore((s) => s.dismissed)
  const skipped = useUserStore((s) => s.settings.ytDlpSkippedVersion)
  const active = state.status === "downloading" || state.status === "installing" || state.status === "waiting"
  if (!active && (state.status !== "available" || !state.latest || state.latest === dismissed || state.latest === skipped)) return null
  const message =
    state.source === "path"
      ? `yt-dlp ${state.latest} is available. This adds a copy just for this app, and leaves your system's copy alone.`
      : `yt-dlp ${state.latest} is available. This updates only yt-dlp.`
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/50 px-4 py-2 text-sm">
      <p className="min-w-0 flex-1">{message}</p>
      <UpdateYtDlpButton />
      {!active && (
        <>
          <Button size="sm" variant="ghost" onClick={() => void updateSettings({ ytDlpSkippedVersion: state.latest })}>
            Skip this version
          </Button>
          <Button size="icon" variant="ghost" aria-label="Not now" onClick={() => useYtDlpStore.setState({ dismissed: state.latest })}>
            <X />
          </Button>
        </>
      )}
    </div>
  )
}

/** Version details and a manual check, for Settings. */
export function YtDlpStatusCard() {
  const state = useYtDlpState()
  useEffect(() => {
    // Opening this card is an explicit look at the status, so it's worth asking GitHub.
    if (useYtDlpStore.getState().state.status === "idle") void call(window.api.tools.checkYtDlp()).catch(() => {})
  }, [])
  const showUpdate = state.status === "available" || state.status === "error" || BUSY.has(state.status)
  return (
    <Card className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Downloader (yt-dlp)</p>
        <p className="text-xs text-muted-foreground">
          {state.current ? `Version ${state.current}` : "Not installed"}
          {state.status === "up-to-date" && " · up to date"}
          {state.status === "available" && state.latest && ` · ${state.latest} is available`}
          {state.status === "unmanaged" && " · set by B1T_YTDLP, so the app won't change it"}
          {state.status === "unknown" && " · couldn't check for updates"}
        </p>
        {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
      </div>
      {state.status === "up-to-date" && <CheckCircle2 className="size-4 text-success" aria-hidden />}
      {showUpdate && state.status !== "checking" ? (
        <UpdateYtDlpButton />
      ) : (
        <Button size="sm" variant="ghost" disabled={state.status === "checking"} onClick={() => void call(window.api.tools.checkYtDlp()).catch(() => {})}>
          {state.status === "checking" ? <Loader2 className="animate-spin" /> : <RefreshCw />} Check for updates
        </Button>
      )}
    </Card>
  )
}
