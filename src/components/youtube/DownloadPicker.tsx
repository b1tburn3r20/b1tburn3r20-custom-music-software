// "What should come in?" The user ticks what to download; nothing downloads by itself.
import { useEffect, useMemo, useState } from "react"
import { Download, Heart, ListMusic, Loader2, Mic2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { call, errorMessage } from "@/lib/api"
import { matchedSubscriptions } from "@/lib/followedArtists"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { toast } from "sonner"
import { useYoutubeAccess, useYoutubeAccount } from "./accessStore"
import { AuthBanner } from "./AuthBanner"
import { enqueueVideos } from "./downloadActions"
import { useMyPlaylistsStore } from "./myPlaylistsStore"
import { useOwnedIndex } from "./useOwned"
import { PlaylistListSkeleton } from "./Skeletons"

// A typical song as a high-quality MP3. Only used to give a rough idea of disk space.
const MB_PER_SONG = 8

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function formatEstimate(songs: number): string {
  const mb = songs * MB_PER_SONG
  return mb >= 1000 ? `about ${(mb / 1000).toFixed(1)} GB` : `about ${mb} MB`
}

function Row({ checked, onChange, icon: Icon, title, detail }: { checked: boolean; onChange: (v: boolean) => void; icon: typeof Heart; title: string; detail: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-accent/40">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{detail}</span>
    </label>
  )
}

function usePicked(initial: string[] = []) {
  const [picked, setPicked] = useState<Set<string>>(new Set(initial))
  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  return [picked, toggle, setPicked] as const
}

/** Downloads each playlist in full, keeping a copy of it as a local playlist. */
async function downloadPlaylists(playlists: { id: string; title: string }[]) {
  for (const p of playlists) {
    const { videos } = await call(window.api.youtube.playlistItems(p.id))
    await enqueueVideos(
      videos.flatMap((v, index) => (v.unavailable ? [] : [{ videoId: v.id, title: v.title, channel: v.channel, duration: v.duration, index }])),
      { mirror: { youtubeId: p.id, title: p.title } },
    )
  }
}

const startedToast = () => toast.success("Downloading in the background", { description: "Keep using the app. You'll find them under YouTube → Downloads." })

function Footer({ summary, busy, disabled, onSkip, onStart }: { summary: string; busy: boolean; disabled: boolean; onSkip: () => void; onStart: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <p className="mr-auto text-xs text-muted-foreground">{summary}</p>
      <Button variant="ghost" onClick={onSkip}>
        Not now
      </Button>
      <Button disabled={busy || disabled} onClick={onStart}>
        {busy ? <Loader2 className="animate-spin" /> : <Download />} Download
      </Button>
    </div>
  )
}

/** With cookies: the account's playlists, read by yt-dlp. Liked videos is one of them, and starts ticked. */
function CookiePicker({ onDone }: { onDone: () => void }) {
  const playlists = useMyPlaylistsStore((s) => s.playlists)
  const loading = useMyPlaylistsStore((s) => s.loading)
  const error = useMyPlaylistsStore((s) => s.error)
  const [picked, toggle, setPicked] = usePicked()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void useMyPlaylistsStore.getState().loadPlaylists("file")
  }, [])
  useEffect(() => {
    if (playlists?.some((p) => p.id === "LL")) setPicked((prev) => (prev.size ? prev : new Set(["LL"])))
  }, [playlists, setPicked])

  const chosen = (playlists ?? []).filter((p) => picked.has(p.id))
  const known = chosen.reduce((sum, p) => sum + (p.count ?? 0), 0)
  const allKnown = chosen.every((p) => p.count != null)
  const summary = !chosen.length ? "Nothing picked. You can do this later from the YouTube page." : known && allKnown ? `${plural(known, "song")}, ${formatEstimate(known)}` : plural(chosen.length, "playlist")

  const start = async () => {
    setBusy(true)
    try {
      await downloadPlaylists(chosen)
      startedToast()
      onDone()
    } catch (err) {
      toast.error("Couldn't start every download", { description: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <AuthBanner code={error.code} message={error.message} />}
      {loading && !playlists && <PlaylistListSkeleton rows={3} />}
      {playlists && (
        <section className="flex max-h-72 flex-col overflow-y-auto">
          {playlists.map((p) => (
            <Row key={p.id} checked={picked.has(p.id)} onChange={(on) => toggle(p.id, on)} icon={p.id === "LL" ? Heart : ListMusic} title={p.title} detail={p.count != null ? plural(p.count, "video") : ""} />
          ))}
        </section>
      )}
      <Footer summary={summary} busy={busy} disabled={!chosen.length} onSkip={onDone} onStart={() => void start()} />
    </div>
  )
}

/** With Google sign-in: likes can be told apart from non-music, and followed artists are known. */
function GooglePicker({ onDone }: { onDone: () => void }) {
  const account = useYoutubeAccount((s) => s.account)
  const songs = useLibraryStore((s) => s.songs)
  const owned = useOwnedIndex()
  const [likes, setLikes] = useState(true)
  const [nonMusic, setNonMusic] = useState(false)
  const [picked, toggle] = usePicked()
  const [busy, setBusy] = useState(false)

  const liked = useMemo(() => account?.liked ?? [], [account])
  const newLikes = useMemo(() => liked.filter((v) => (nonMusic || v.isMusic) && !owned(v)), [liked, nonMusic, owned])
  const skippedNonMusic = useMemo(() => liked.filter((v) => !v.isMusic).length, [liked])
  const playlists = account?.playlists ?? []
  const artists = useMemo(() => matchedSubscriptions(songs, account?.subscriptions ?? []), [songs, account])
  const estimate = (likes ? newLikes.length : 0) + playlists.filter((p) => picked.has(p.id)).reduce((sum, p) => sum + (p.count ?? 0), 0)

  const start = async () => {
    setBusy(true)
    try {
      if (likes && newLikes.length) await enqueueVideos(newLikes.map((v) => ({ videoId: v.id, title: v.title, channel: v.channel, duration: v.duration })))
      await downloadPlaylists(playlists.filter((pl) => picked.has(pl.id)))
      if (estimate) startedToast()
      onDone()
    } catch (err) {
      toast.error("Couldn't start every download", { description: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  if (!account) return null
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">Your likes</h3>
        <Row checked={likes} onChange={setLikes} icon={Heart} title="Liked videos" detail={`${newLikes.length} new`} />
        {skippedNonMusic > 0 && (
          <div className="flex items-center gap-2 px-2 py-1">
            <Switch id="picker-non-music" checked={nonMusic} onCheckedChange={setNonMusic} />
            <Label htmlFor="picker-non-music" className="text-xs font-normal text-muted-foreground">
              Include {plural(skippedNonMusic, "liked video")} that {skippedNonMusic === 1 ? "isn't" : "aren't"} music
            </Label>
          </div>
        )}
      </section>

      {playlists.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">Your playlists</h3>
          <div className="flex max-h-56 flex-col overflow-y-auto">
            {playlists.map((p) => (
              <Row key={p.id} checked={picked.has(p.id)} onChange={(on) => toggle(p.id, on)} icon={ListMusic} title={p.title} detail={p.count != null ? plural(p.count, "video") : ""} />
            ))}
          </div>
        </section>
      )}

      {(account.subscriptions.length > 0 || artists.length > 0) && (
        <section className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <Mic2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>You follow {plural(account.subscriptions.length, "channel")}. Songs by artists you follow get a small boost on your radio, with nothing to download.</p>
        </section>
      )}

      <Footer summary={estimate ? `${plural(estimate, "song")}, ${formatEstimate(estimate)}` : "Nothing picked. Anything you skip stays available as a suggestion."} busy={busy} disabled={!estimate} onSkip={onDone} onStart={() => void start()} />
    </div>
  )
}

export function DownloadPicker({ onDone }: { onDone: () => void }) {
  const connected = useYoutubeAccess((s) => s.access?.connected ?? false)
  return connected ? <GooglePicker onDone={onDone} /> : <CookiePicker onDone={onDone} />
}
