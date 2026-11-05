// Layer 1 of YouTube access: the user's own API key unlocks searching YouTube.
import { useState } from "react"
import { CheckCircle2, ExternalLink, KeyRound, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/base/Layout"
import { Modal } from "@/components/base/Modal"
import { call, errorMessage } from "@/lib/api"
import { toast } from "sonner"
import { canSearch, useYoutubeAccess } from "./accessStore"

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

export function ExternalLinkText({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
      {children} <ExternalLink className="size-3" aria-hidden />
    </a>
  )
}

/** Shown when the OS offers no real encryption, so saving is the user's informed choice. */
export function WeakStorageNotice({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs">
      <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>Your system has no keyring, so this can't be encrypted properly. It will be forgotten when you close the app. Tick this to save it anyway with weak protection.</span>
    </label>
  )
}

export function ApiKeyForm({ onDone }: { onDone?: () => void }) {
  const secure = useYoutubeAccess((s) => s.access?.secureStorage ?? true)
  const [key, setKey] = useState("")
  const [allowWeak, setAllowWeak] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const { persisted } = await call(window.api.youtube.setApiKey(key, { allowWeak }))
      setKey("")
      toast.success("YouTube search unlocked", { description: persisted ? "Your key is stored encrypted on this computer." : "Your key will be forgotten when you close the app." })
      onDone?.()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={save}>
      <ol className="flex flex-col gap-3">
        <Step n={1}>
          <ExternalLinkText href="https://console.cloud.google.com/projectcreate">Create a Google Cloud project</ExternalLinkText>. Any name works, and it's free.
        </Step>
        <Step n={2}>
          <ExternalLinkText href="https://console.cloud.google.com/apis/library/youtube.googleapis.com">Turn on YouTube Data API v3</ExternalLinkText> for that project.
        </Step>
        <Step n={3}>
          <ExternalLinkText href="https://console.cloud.google.com/apis/credentials">Open Credentials</ExternalLinkText>, then choose <b>Create credentials → API key</b>. Restrict it to the YouTube Data API v3, with no website or IP limits.
        </Step>
        <Step n={4}>
          <Label htmlFor="yt-api-key" className="mb-1.5 block">
            Paste the key here
          </Label>
          <Input id="yt-api-key" type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} placeholder="API key" />
        </Step>
      </ol>
      {!secure && <WeakStorageNotice checked={allowWeak} onChange={setAllowWeak} />}
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">The key stays on this computer. It's only sent to Google, and it allows about 100 searches a day, free.</p>
      <Button type="submit" disabled={!key.trim() || saving} className="self-end">
        {saving ? <Loader2 className="animate-spin" /> : <KeyRound />} {saving ? "Checking with Google…" : "Save key"}
      </Button>
    </form>
  )
}

export function ApiKeyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Add a YouTube API key" description="This unlocks searching YouTube. It takes a few minutes, once.">
      <ApiKeyForm onDone={onClose} />
    </Modal>
  )
}

/** Key status and controls, for Settings. */
export function ApiKeyCard() {
  const access = useYoutubeAccess((s) => s.access)
  const [adding, setAdding] = useState(false)
  const remove = async () => {
    try {
      await call(window.api.youtube.removeApiKey())
      toast.success("API key removed", { description: "YouTube search is locked again." })
    } catch (err) {
      toast.error("Couldn't remove the key", { description: errorMessage(err) })
    }
  }
  const has = canSearch(access)
  return (
    <Card className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          {has && <CheckCircle2 className="size-4 text-success" aria-hidden />} Search YouTube
        </p>
        <p className="text-xs text-muted-foreground">
          {access?.unreadable.includes("apiKey") ? "Your saved key couldn't be read on this computer. Please enter it again." : has ? "Your API key is set." : "Needs your own YouTube API key."}
        </p>
      </div>
      <Button size="sm" variant={has ? "ghost" : "default"} onClick={() => setAdding(true)}>
        <KeyRound /> {has ? "Replace key" : "Add API key"}
      </Button>
      {has && (
        <Button size="sm" variant="ghost" onClick={() => void remove()}>
          <Trash2 /> Remove
        </Button>
      )}
      <ApiKeyDialog open={adding} onClose={() => setAdding(false)} />
    </Card>
  )
}
