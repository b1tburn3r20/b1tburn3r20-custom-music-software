import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, FileUp, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/base/Layout"
import { AuthBanner } from "@/components/youtube/AuthBanner"
import { YtDlpStatusCard } from "@/components/youtube/YtDlpUpdate"
import { ApiKeyCard } from "@/components/youtube/ApiKeySetup"
import { GoogleAccountCard } from "@/components/youtube/GoogleSetup"
import { CookieUpload } from "@/components/youtube/CookieUpload"
import { chooseCookiesFile } from "@/components/youtube/cookieFile"
import { updateSettings } from "@/lib/actions"
import { ApiError, call, errorMessage } from "@/lib/api"
import type { YoutubeAuthStatus } from "@/types/api"
import { toast } from "sonner"

/** Everything YouTube: cookies.txt first, then the downloader, then the other ways in. */
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
      if (await chooseCookiesFile()) {
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

  const usingFile = status.mode === "file" && status.hasCookieFile
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">YouTube is optional. Your library, radio and everything else work without it.</p>

      <Card className="flex flex-col gap-3 p-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            {usingFile && <CheckCircle2 className="size-4 text-success" aria-hidden />} Your YouTube account
          </p>
          <p className="text-xs text-muted-foreground">{usingFile ? "Connected with your cookies.txt file. It's kept on this computer, but it isn't encrypted, because yt-dlp has to read it." : "Upload a cookies.txt file in Netscape format."}</p>
        </div>
        {status.hasCookieFile ? (
          <div className="flex flex-wrap gap-2">
            {!usingFile && <Button onClick={() => void update({ mode: "file" })}>Use this file</Button>}
            <Button variant="secondary" onClick={importFile}>
              <FileUp /> Replace file…
            </Button>
            <Button variant="ghost" onClick={removeFile}>
              <Trash2 /> Remove
            </Button>
          </div>
        ) : (
          <CookieUpload onImported={() => void refresh()} />
        )}
        {status.mode !== "none" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Button size="sm" variant="ghost" onClick={runCheck} disabled={checking || (status.mode === "file" && !status.hasCookieFile)}>
                {checking ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Check it works
              </Button>
              {check?.ok && <p className="text-sm text-success">Working: found {check.playlists} playlists.</p>}
            </div>
            {check?.ok && check.downloadIssue && <AuthBanner code="YTDLP_JS_CHALLENGE" message={check.downloadIssue} />}
            {check && !check.ok && check.code && <AuthBanner code={check.code} message={check.message ?? "Sign-in failed."} />}
          </div>
        )}
      </Card>

      <YtDlpStatusCard />

      <details className="rounded-xl border border-border p-3" open={status.mode === "browser"}>
        <summary className="cursor-pointer text-sm font-medium">Other options</summary>
        <div className="mt-3 flex flex-col gap-4">
          <ApiKeyCard />
          <GoogleAccountCard />
          <Card className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium">Your browser's sign-in, instead of a file</p>
              <p className="text-xs text-muted-foreground">yt-dlp reads your YouTube cookies directly from the browser. Close the browser if it reports a locked database. Firefox is the most reliable; Chrome and Edge often can't be read on Windows.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={status.mode === "browser" ? "default" : "secondary"} onClick={() => void update({ mode: status.mode === "browser" ? "none" : "browser" })}>
                {status.mode === "browser" ? "Turn off" : "Use my browser's sign-in"}
              </Button>
            </div>
            {status.mode === "browser" && (
              <>
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
              </>
            )}
          </Card>
        </div>
      </details>

      <Button variant="ghost" size="sm" className="self-start" onClick={() => void updateSettings({ onboarding: { status: "pending", step: "folder" } })}>
        Run first-time setup again
      </Button>
    </div>
  )
}
