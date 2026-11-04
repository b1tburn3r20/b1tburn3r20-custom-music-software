import { useEffect } from "react"
import { RefreshCcw, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/base/Page"
import { useUserStore } from "@/stores/useUserStore"
import { openSettings } from "@/app/settings/settingsStore"
import { PlaylistPanel } from "./PlaylistPanel"
import { AuthBanner } from "./AuthBanner"
import { useMyPlaylistsStore } from "./myPlaylistsStore"

/** The signed-in user's own YouTube playlists (including private ones and Liked videos). Cached; "Refresh" resyncs. */
export function MyPlaylists() {
  const mode = useUserStore((s) => s.settings.youtubeAuth.mode)
  const playlists = useMyPlaylistsStore((s) => s.playlists)
  const loading = useMyPlaylistsStore((s) => s.loading)
  const error = useMyPlaylistsStore((s) => s.error)
  const items = useMyPlaylistsStore((s) => s.items)
  const open = useMyPlaylistsStore((s) => s.open)
  const { loadPlaylists, loadItems, setOpen } = useMyPlaylistsStore.getState()

  // Fetches only the first time (or after the sign-in method changes); otherwise uses the cache.
  useEffect(() => {
    if (mode !== "none") void loadPlaylists(mode)
  }, [mode, loadPlaylists])

  if (mode === "none")
    return (
      <EmptyState
        icon={LogIn}
        title="Sign in to see your playlists"
        hint="Use your browser's YouTube sign-in or an exported cookies file. This only lets the downloader act as your account — e.g. for your private playlists and age-restricted videos you can already watch."
        action={<Button onClick={() => openSettings("youtube")}>Set up sign-in</Button>}
      />
    )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{playlists ? `${playlists.length} playlists` : loading ? "Loading your playlists…" : ""}</p>
        <Button size="sm" variant="ghost" onClick={() => loadPlaylists(mode, true)} disabled={loading} title="Fetch your playlists from YouTube again">
          <RefreshCcw className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>
      {error && <AuthBanner code={error.code} message={error.message} />}
      {playlists?.map((p) => {
        const it = items[p.id]
        return (
          <PlaylistPanel
            key={p.id}
            id={p.id}
            title={p.title}
            subtitle={p.system ? "Private · system playlist" : p.count != null ? `${p.count} videos` : undefined}
            thumbnail={p.thumbnail}
            videos={it?.videos ?? null}
            loading={it?.loading ?? false}
            error={it?.error ?? null}
            open={Boolean(open[p.id])}
            onOpenChange={(o) => {
              setOpen(p.id, o)
              if (o) void loadItems(p.id)
            }}
            onRefresh={() => loadItems(p.id, true)}
          />
        )
      })}
    </div>
  )
}
