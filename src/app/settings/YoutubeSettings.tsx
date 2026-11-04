import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, FileUp, Loader2, ShieldCheck, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/base/Layout"
import { AuthBanner } from "@/components/youtube/AuthBanner"
import { ApiError, call, errorMessage } from "@/lib/api"
import type { YoutubeAuthStatus } from "@/types/api"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const MODES: { id: YoutubeAuthStatus["mode"]; label: string; hint: string }[] = [
  { id: "none", label: "Not signed in", hint: "Public videos only." },
  { id: "browser", label: "Use my browser's sign-in", hint: "yt-dlp reads your YouTube cookies directly from the browser. Close the browser if it reports a locked database." },
  { id: "file", label: "Use an exported cookies file", hint: "Export cookies.txt for youtube.com with a browser extension while signed in, then import it here." },
]

/** YouTube sign-in for your own account (age-restricted videos you can watch, private playlists). */
export default function YoutubeSettings() {
  const [status, setStatus] = useState<YoutubeAuthStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [check, setCheck] = useState<{ ok: boolean; code?: string; message?: string; playlists?: number; downloadIssue?: string | null } | null>(null)
  const [profile, setProfile] = useState("")

  const refresh = useCallback(async () => {
    const s = await call(window.api.youtube.authStatus())
    setStatus(s)
    setProfile(s.profile)
    if (s.lastCheck) setCheck(s.lastCheck)
  }, [])
  useEffect(() => {
    refresh().catch((e) => toast.error("Couldn't load YouTube settings", { description: errorMessage(e) }))
  }, [refresh])

  const update = async (patch: Partial<Pick<YoutubeAuthStatus, "mode" | "browser" | "profile">>) => {
    try {
      setStatus(await call(window.api.youtube.setAuth(patch)))
      setCheck(null)
    } catch (e) {
      toast.error("Couldn't save", { description: errorMessage(e) })
    }
  }
  const runCheck = async () => {
    setChecking(true)
    try {
      const r = await call(window.api.youtube.checkAuth())
      setCheck(r)
    } catch (e) {
      setCheck({ ok: false, code: e instanceof ApiError ? e.code : "ERROR", message: errorMessage(e) })
    } finally {
      setChecking(false)
    }
  }
  const importFile = async () => {
    try {
      const r = await call(window.api.youtube.importCookies())
      if (r) {
        toast.success("Cookies imported", { description: `Stored privately in the app's data folder. You can now delete “${r.imported}” from wherever you exported it.` })
        await refresh()
        void runCheck()
      }
    } catch (e) {
      toast.error("Couldn't import cookies", { description: errorMessage(e) })
    }
  }
  const removeFile = async () => {
    try {
      setStatus(await call(window.api.youtube.removeCookies()))
      setCheck(null)
      toast.success("Stored cookies deleted")
    } catch (e) {
      toast.error("Couldn't delete cookies", { description: errorMessage(e) })
    }
  }

  if (!status) return <p className="text-sm text-muted-foreground">Loading…</p>
  const installed = status.browsers.filter((b) => b.installed)
  const browsers = installed.length ? installed : status.browsers

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4 text-success" aria-hidden /> Your account, your device
        </p>
        <p className="text-xs text-muted-foreground">Sign-in uses yt-dlp's supported cookie options. Cookies stay on this computer, are never logged, and an imported file is kept with owner-only permissions.</p>
      </Card>

      <div role="radiogroup" aria-label="YouTube sign-in" className="flex flex-col gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={status.mode === m.id}
            onClick={() => update({ mode: m.id })}
            className={cn("rounded-xl border-2 p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring", status.mode === m.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground")}
          >
            <p className="text-sm font-medium">{m.label}</p>
            <p className="text-xs text-muted-foreground">{m.hint}</p>
          </button>
        ))}
      </div>

      {status.mode === "browser" && (
        <Card className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="yt-browser">Browser</Label>
            <select id="yt-browser" value={status.browser} onChange={(e) => update({ browser: e.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              {browsers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                  {!b.installed ? " (not detected)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="yt-profile">Profile (optional)</Label>
            <Input id="yt-profile" value={profile} placeholder="e.g. Default or Profile 1" onChange={(e) => setProfile(e.target.value)} onBlur={() => profile !== status.profile && update({ profile })} />
          </div>
        </Card>
      )}

      {status.mode === "file" && (
        <Card className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm">{status.hasCookieFile ? "A cookies file is imported." : "No cookies file imported yet."}</p>
          <Button variant="secondary" onClick={importFile}>
            <FileUp /> {status.hasCookieFile ? "Replace…" : "Import cookies.txt…"}
          </Button>
          {status.hasCookieFile && (
            <Button variant="ghost" onClick={removeFile}>
              <Trash2 /> Delete stored copy
            </Button>
          )}
        </Card>
      )}

      {status.mode !== "none" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Button onClick={runCheck} disabled={checking || (status.mode === "file" && !status.hasCookieFile)}>
              {checking ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Check sign-in
            </Button>
            {check?.ok && <p className="text-sm text-success">Signed in — found {check.playlists} playlists.</p>}
          </div>
          {check?.ok && check.downloadIssue && <AuthBanner code="YTDLP_JS_CHALLENGE" message={check.downloadIssue} />}
          {check && !check.ok && check.code && <AuthBanner code={check.code} message={check.message ?? "Sign-in failed."} />}
        </div>
      )}
    </div>
  )
}
