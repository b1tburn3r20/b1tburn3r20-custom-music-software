// Layer 2 of YouTube access: the user's own Google client and sign-in unlock their data.
import { useState } from "react"
import { CheckCircle2, FileUp, Loader2, RefreshCcw, ShieldCheck, Trash2, Unplug, UserCheck, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/base/Layout"
import { Modal } from "@/components/base/Modal"
import { ApiError, call, errorMessage } from "@/lib/api"
import { toast } from "sonner"
import { useYoutubeAccess } from "./accessStore"
import { ExternalLinkText, WeakStorageNotice } from "./ApiKeySetup"

const PERMISSIONS_PAGE = "https://myaccount.google.com/connections"

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium" aria-hidden>
        {n}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </li>
  )
}

/** Exactly what's accessed and why, shown before the user is sent to Google. */
export function DataExplanation() {
  return (
    <Card className="flex flex-col gap-2 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <ShieldCheck className="size-4 text-success" aria-hidden /> What this does
      </p>
      <p>
        <b>Reads</b> your playlists, liked videos and subscriptions, to find your music and shape your radio.
      </p>
      <p>
        <b>Can't</b> post, change anything on your account, see your password, or read your watch history.
      </p>
      <p>
        <b>Stays</b> on this computer. There's no server. You can disconnect any time.
      </p>
    </Card>
  )
}

function ClientForm({ onSaved }: { onSaved: () => void }) {
  const secure = useYoutubeAccess((s) => s.access?.secureStorage ?? true)
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [allowWeak, setAllowWeak] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async (input: { clientId: string; clientSecret: string } | string) => {
    setSaving(true)
    setError(null)
    try {
      await call(window.api.youtube.setClient(input, { allowWeak }))
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }
  const importFile = async (file: File | undefined) => {
    if (file) await save(await file.text())
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save({ clientId, clientSecret })
      }}
    >
      <ol className="flex flex-col gap-3">
        <Step n={1}>
          Use the same <ExternalLinkText href="https://console.cloud.google.com/apis/library/youtube.googleapis.com">Google Cloud project, with YouTube Data API v3 turned on</ExternalLinkText>. If you haven't made one, this link creates it.
        </Step>
        <Step n={2}>
          Open <ExternalLinkText href="https://console.cloud.google.com/auth/branding">Google Auth Platform</ExternalLinkText> and fill in the app name (anything, it's only shown to you) and your email. Choose <b>External</b> if asked.
        </Step>
        <Step n={3}>
          Under <ExternalLinkText href="https://console.cloud.google.com/auth/audience">Audience</ExternalLinkText>, choose <b>Publish app</b>. If you skip this, you'll have to sign in again every 7 days.
        </Step>
        <Step n={4}>
          Under <ExternalLinkText href="https://console.cloud.google.com/auth/clients/create">Clients</ExternalLinkText>, create a client with the type <b>Desktop app</b>.
        </Step>
        <Step n={5}>
          <p className="mb-2">Download its JSON file and choose it here, or paste the ID and secret.</p>
          <div className="flex flex-col gap-2">
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm font-medium">
              <FileUp className="size-4" aria-hidden /> Choose JSON file…
              <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => void importFile(e.target.files?.[0])} />
            </label>
            <div>
              <Label htmlFor="yt-client-id" className="mb-1.5 block">
                Client ID
              </Label>
              <Input id="yt-client-id" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" spellCheck={false} placeholder="….apps.googleusercontent.com" />
            </div>
            <div>
              <Label htmlFor="yt-client-secret" className="mb-1.5 block">
                Client secret
              </Label>
              <Input id="yt-client-secret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} autoComplete="off" spellCheck={false} />
            </div>
          </div>
        </Step>
      </ol>
      {!secure && <WeakStorageNotice checked={allowWeak} onChange={setAllowWeak} />}
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="self-end" disabled={!clientId.trim() || saving}>
        {saving && <Loader2 className="animate-spin" />} Save and continue
      </Button>
    </form>
  )
}

/** Sends the user to Google, and handles every way that can end. */
export function ConnectPanel({ onConnected }: { onConnected?: () => void }) {
  const [connecting, setConnecting] = useState(false)
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null)

  const connect = async () => {
    setConnecting(true)
    setProblem(null)
    try {
      const { syncError } = await call(window.api.youtube.connect())
      toast.success("YouTube connected")
      if (syncError) toast.warning("Some of your data didn't load", { description: syncError.message })
      onConnected?.()
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "ERROR"
      if (code !== "CONNECT_CANCELLED") setProblem({ code, message: errorMessage(err) })
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <DataExplanation />
      <Card className="flex flex-col gap-1 text-sm">
        <p className="font-medium">Google will warn you that the app isn't verified</p>
        <p className="text-muted-foreground">
          That's expected: it's your own Google project, which you just created, and only you use it. Choose <b>Advanced</b>, then <b>Go to (your app name)</b>, then allow access.
        </p>
      </Card>
      {problem && (
        <div role="alert" className="rounded-lg bg-warning/10 p-3 text-sm">
          <p className="font-medium">{problem.code === "CONNECT_DENIED" ? "Nothing was connected" : "That didn't finish"}</p>
          <p className="mt-1 text-muted-foreground">{problem.message}</p>
          <p className="mt-1 text-muted-foreground">You can try again, or carry on without it. Everything else in the app still works.</p>
        </div>
      )}
      {connecting ? (
        <div className="flex items-center gap-3">
          <p className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Waiting for you to finish in your browser…
          </p>
          <Button variant="ghost" onClick={() => void window.api.youtube.cancelConnect()}>
            <X /> Cancel
          </Button>
        </div>
      ) : (
        <Button className="self-end" onClick={() => void connect()}>
          <UserCheck /> {problem ? "Try again" : "Continue to Google"}
        </Button>
      )}
    </div>
  )
}

export function GoogleSetupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const hasClient = useYoutubeAccess((s) => s.access?.hasOAuthClient ?? false)
  const connected = useYoutubeAccess((s) => s.access?.connected ?? false)
  return (
    <Modal open={open} onClose={onClose} title={hasClient ? "Connect your YouTube account" : "Set up Google sign-in"} description={hasClient ? "This unlocks loading your own data." : "This takes about ten minutes, once. It unlocks loading your own data."}>
      {connected ? (
        <p className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4 text-success" aria-hidden /> You're connected.
        </p>
      ) : hasClient ? (
        <ConnectPanel onConnected={onClose} />
      ) : (
        <ClientForm onSaved={() => {}} />
      )}
    </Modal>
  )
}

function DisconnectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [removeMirrors, setRemoveMirrors] = useState(false)
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const { revoked } = await call(window.api.youtube.disconnect({ removeMirrors }))
      if (revoked) toast.success("YouTube disconnected", { description: "Google's access was revoked, and your YouTube data was removed from this computer." })
      else
        toast.warning("Disconnected from this computer only", {
          description: "Google couldn't be reached to revoke access. You can remove it yourself on your Google account's connections page.",
          duration: Infinity,
          action: { label: "Open page", onClick: () => window.open(PERMISSIONS_PAGE, "_blank") },
        })
      onClose()
    } catch (err) {
      toast.error("Couldn't disconnect", { description: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Disconnect YouTube?"
      description="This revokes the app's access at Google and deletes your YouTube data from this computer. Your downloaded music stays."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => void run()}>
            {busy ? <Loader2 className="animate-spin" /> : <Unplug />} Disconnect
          </Button>
        </>
      }
    >
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={removeMirrors} onChange={(e) => setRemoveMirrors(e.target.checked)} />
        <span>Also remove the playlists copied from YouTube. Their songs stay in your library.</span>
      </label>
    </Modal>
  )
}

/** Connection status and controls, for Settings. */
export function GoogleAccountCard() {
  const access = useYoutubeAccess((s) => s.access)
  const [setup, setSetup] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const refresh = async () => {
    setRefreshing(true)
    try {
      const { syncError } = await call(window.api.youtube.refreshAccount())
      if (syncError) toast.warning("Some of your data didn't load", { description: syncError.message })
      else toast.success("Your YouTube data is up to date")
    } catch (err) {
      toast.error("Couldn't refresh", { description: errorMessage(err) })
    } finally {
      setRefreshing(false)
    }
  }
  const removeClient = async () => {
    try {
      await call(window.api.youtube.removeClient())
      toast.success("Google client removed")
    } catch (err) {
      toast.error("Couldn't remove the client", { description: errorMessage(err) })
    }
  }
  const unreadable = access?.unreadable.includes("oauthClient") || access?.unreadable.includes("oauthToken")
  const status = access?.connected
    ? `Connected${access.channel ? ` as ${access.channel.title}` : ""}. Your data is loaded and stays on this computer.`
    : access?.needsReconnect
      ? "Your sign-in has ended. Reconnect to keep loading your data."
      : unreadable
        ? "Your saved sign-in couldn't be read on this computer. Please set it up again."
        : access?.hasOAuthClient
          ? "Your Google client is set. Connect your account to finish."
          : "Needs your own Google sign-in client."
  return (
    <Card className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1 basis-60">
        <p className="flex items-center gap-2 text-sm font-medium">
          {access?.connected && <CheckCircle2 className="size-4 text-success" aria-hidden />} Load your YouTube data
        </p>
        <p className="text-xs text-muted-foreground">{status}</p>
      </div>
      {access?.connected ? (
        <>
          <Button size="sm" variant="ghost" disabled={refreshing} onClick={() => void refresh()}>
            <RefreshCcw className={refreshing ? "animate-spin" : ""} /> Refresh
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDisconnecting(true)}>
            <Unplug /> Disconnect
          </Button>
        </>
      ) : (
        <Button size="sm" onClick={() => setSetup(true)}>
          <UserCheck /> {access?.hasOAuthClient ? (access.needsReconnect ? "Reconnect" : "Connect") : "Connect Google"}
        </Button>
      )}
      {access?.hasOAuthClient && (
        <Button size="sm" variant="ghost" onClick={() => void removeClient()}>
          <Trash2 /> Remove client
        </Button>
      )}
      <GoogleSetupDialog open={setup} onClose={() => setSetup(false)} />
      <DisconnectDialog open={disconnecting} onClose={() => setDisconnecting(false)} />
    </Card>
  )
}
