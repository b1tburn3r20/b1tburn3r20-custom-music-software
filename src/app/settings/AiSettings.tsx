// Automatic tagging with the user's own Claude or OpenAI key. Only songs with no tags are
// touched, and everything else in the app works without this.
import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, KeyRound, Loader2, Sparkles, Square, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/base/Layout"
import { ExternalLinkText, WeakStorageNotice } from "@/components/youtube/ApiKeySetup"
import { updateSettings } from "@/lib/actions"
import { call, errorMessage } from "@/lib/api"
import { GENRE_GROUPS } from "@/lib/tagPresets"
import { cn } from "@/lib/utils"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { useUserStore } from "@/stores/useUserStore"
import type { AiProvider, AiStatus, AiTier } from "@/types/api"
import { toast } from "sonner"

const TIERS: { id: AiTier; label: string; hint: string }[] = [
  { id: "low", label: "Low", hint: "Cheapest, and good for most libraries." },
  { id: "medium", label: "Medium", hint: "Better with obscure songs." },
  { id: "high", label: "High", hint: "The most careful. Rarely needed for tagging." },
]

function formatCount(n: number) {
  return n >= 1000 ? `${Math.round(n / 100) / 10}k`.replace(".0k", "k") : String(n)
}

function formatCost(dollars: number) {
  if (dollars < 0.01) return "under 1 cent"
  return `about $${dollars < 10 ? dollars.toFixed(2) : Math.round(dollars)}`
}

function KeyCard({ id, status, onChanged }: { id: AiProvider; status: AiStatus; onChanged: () => void }) {
  const provider = status.providers[id]
  const has = status.hasKey[id]
  const [editing, setEditing] = useState(false)
  const [key, setKey] = useState("")
  const [allowWeak, setAllowWeak] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputId = `ai-key-${id}`

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const { persisted } = await call(window.api.ai.setKey(id, key, { allowWeak }))
      setKey("")
      setEditing(false)
      toast.success(`${provider.label} key saved`, { description: persisted ? "It's stored encrypted on this computer." : "It will be forgotten when you close the app." })
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }
  const remove = async () => {
    try {
      await call(window.api.ai.removeKey(id))
      onChanged()
    } catch (err) {
      toast.error("Couldn't remove the key", { description: errorMessage(err) })
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-48">
          <p className="flex items-center gap-2 text-sm font-medium">
            {has && <CheckCircle2 className="size-4 text-success" aria-hidden />} {provider.label} API key
          </p>
          <p className="text-xs text-muted-foreground">{has ? "Your key is set." : <>Create one on <ExternalLinkText href={provider.keysUrl}>the {provider.label} keys page</ExternalLinkText>.</>}</p>
        </div>
        {!editing && (
          <Button size="sm" variant={has ? "ghost" : "secondary"} onClick={() => setEditing(true)}>
            <KeyRound /> {has ? "Replace key" : "Add key"}
          </Button>
        )}
        {has && !editing && (
          <Button size="sm" variant="ghost" aria-label={`Remove ${provider.label} key`} onClick={() => void remove()}>
            <Trash2 /> Remove
          </Button>
        )}
      </div>
      {editing && (
        <form className="flex flex-col gap-2" onSubmit={save}>
          <Label htmlFor={inputId}>Paste your {provider.label} key</Label>
          <Input id={inputId} type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} autoFocus />
          {!status.secureStorage && <WeakStorageNotice checked={allowWeak} onChange={setAllowWeak} />}
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!key.trim() || saving}>
              {saving && <Loader2 className="animate-spin" />} {saving ? "Checking…" : "Save key"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}

export default function AiSettings() {
  const [status, setStatus] = useState<AiStatus | null>(null)
  const providerId = useUserStore((s) => s.settings.aiProvider)
  const tier = useUserStore((s) => s.settings.aiTier)
  const songs = useLibraryStore((s) => s.songs)
  const songTags = useUserStore((s) => s.songTags)
  const untagged = useMemo(() => songs.filter((s) => !songTags[s.id]?.length).length, [songs, songTags])

  const refresh = useCallback(() => {
    call(window.api.ai.status()).then(setStatus, (err) => toast.error("Couldn't load AI settings", { description: errorMessage(err) }))
  }, [])
  useEffect(() => {
    refresh()
    return window.api.ai.onProgress((progress) => setStatus((s) => (s ? { ...s, ...progress } : s)))
  }, [refresh])

  if (!status) return <p className="text-sm text-muted-foreground">Loading…</p>

  const provider = status.providers[providerId]
  const start = async () => {
    try {
      // Your own tags count too, so the AI uses the words you already use.
      const vocabulary = [...new Set([...GENRE_GROUPS.flatMap((g) => g.genres), ...Object.values(useUserStore.getState().songTags).flat()])]
      const progress = await call(window.api.ai.start({ vocabulary }))
      setStatus((s) => (s ? { ...s, ...progress } : s))
    } catch (err) {
      toast.error("Couldn't start tagging", { description: errorMessage(err) })
    }
  }
  const finished = !status.running && status.total > 0 && !status.error
  const percent = status.total ? Math.round((status.done / status.total) * 100) : 0

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Let an AI tag songs that have no tags, so radio and mixes work across your whole library. It's optional, it uses your own account with the provider, and it never changes songs you've already tagged.</p>

      <div className="flex flex-col gap-1.5">
        <Label>Provider</Label>
        <div role="radiogroup" aria-label="AI provider" className="flex gap-2">
          {(Object.keys(status.providers) as AiProvider[]).map((id) => (
            <Button key={id} type="button" role="radio" aria-checked={providerId === id} variant={providerId === id ? "default" : "secondary"} onClick={() => void updateSettings({ aiProvider: id })}>
              {status.providers[id].label}
            </Button>
          ))}
        </div>
      </div>

      <KeyCard key={providerId} id={providerId} status={status} onChanged={refresh} />

      <div className="flex flex-col gap-1.5">
        <Label>Model</Label>
        <div role="radiogroup" aria-label="Model" className="grid gap-2 md:grid-cols-3">
          {TIERS.map((t) => {
            const info = provider.tiers[t.id]
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={tier === t.id}
                onClick={() => void updateSettings({ aiTier: t.id })}
                className={cn("flex flex-col gap-1 rounded-xl border-2 p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring", tier === t.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground")}
              >
                <span className="text-sm font-medium">{t.label}</span>
                <span className="text-xs text-muted-foreground">{info.name}</span>
                <span className="text-xs text-muted-foreground">{t.hint}</span>
                <span className="mt-auto pt-1 text-xs font-medium">About {formatCount(info.songsPerDollar)} songs per $1</span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">Rough estimates from published prices. Your provider bills you directly.</p>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 basis-48">
            <p className="text-sm font-medium">{!songs.length ? "No songs yet" : untagged ? `${untagged} ${untagged === 1 ? "song has" : "songs have"} no tags` : "Every song has tags"}</p>
            {untagged > 0 && <p className="text-xs text-muted-foreground">With {provider.tiers[tier].name}, tagging them costs {formatCost(untagged / provider.tiers[tier].songsPerDollar)}.</p>}
          </div>
          {status.running ? (
            <Button variant="secondary" onClick={() => void window.api.ai.cancel()}>
              <Square /> Stop
            </Button>
          ) : (
            <Button disabled={!untagged || !status.hasKey[providerId]} onClick={() => void start()}>
              <Sparkles /> Tag {untagged || ""} {untagged === 1 ? "song" : "songs"}
            </Button>
          )}
        </div>
        {!status.hasKey[providerId] && untagged > 0 && <p className="text-xs text-muted-foreground">Add your {provider.label} key above to start.</p>}
        {status.running && (
          <div role="progressbar" aria-label="Tagging progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-normal" style={{ width: `${percent}%` }} />
          </div>
        )}
        {status.running && <p className="text-xs text-muted-foreground">{status.done} of {status.total} done. You can keep using the app.</p>}
        {finished && <p className="text-sm text-success">Tagged {status.tagged} {status.tagged === 1 ? "song" : "songs"}.{status.failed > 0 ? ` ${status.failed} couldn't be tagged, so they're still untagged.` : ""}</p>}
        {status.error && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
            {status.error.message}
          </p>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">Sends each untagged song's title, artist, album and genre to {provider.label}, and nothing else: no audio, file paths or listening history. Keys are encrypted on this computer and only sent to their provider.</p>
    </div>
  )
}
