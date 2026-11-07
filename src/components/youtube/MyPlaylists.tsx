import { useEffect } from "react"
import { RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { importLabel } from "@/lib/playlistImport"
import { useUserStore } from "@/stores/useUserStore"
import { useYoutubeAccess } from "./accessStore"
import { PlaylistPanel } from "./PlaylistPanel"
import { AuthBanner } from "./AuthBanner"
import { useMyPlaylistsStore } from "./myPlaylistsStore"
import { PlaylistListSkeleton } from "./Skeletons"

/** The signed-in user's own YouTube playlists (including private ones and Liked videos). Cached; "Refresh" resyncs. */
export function MyPlaylists() {
  const cookieMode = useUserStore((s) => s.settings.youtubeAuth.mode)
  const connected = useYoutubeAccess((s) => s.access?.connected ?? false)
  const channelId = useYoutubeAccess((s) => s.access?.channel?.id ?? "")
  // The cache belongs to one account: a different one must fetch its own.
  const mode = connected ? `oauth:${channelId}` : cookieMode
  const playlists = useMyPlaylistsStore((s) => s.playlists)
  const locals = useUserStore((s) => s.playlists)
  const loading = useMyPlaylistsStore((s) => s.loading)
  const error = useMyPlaylistsStore((s) => s.error)
  const items = useMyPlaylistsStore((s) => s.items)
  const open = useMyPlaylistsStore((s) => s.open)
  const { loadPlaylists, loadItems, setOpen } = useMyPlaylistsStore.getState()

  // Fetches only the first time (or after the sign-in method changes); otherwise uses the cache.
  useEffect(() => {
    void loadPlaylists(mode)
  }, [mode, loadPlaylists])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{playlists ? `${playlists.length} ${playlists.length === 1 ? "playlist" : "playlists"}` : ""}</p>
        <Button size="sm" variant="ghost" onClick={() => loadPlaylists(mode, true)} disabled={loading} title="Fetch your playlists from YouTube again">
          <RefreshCcw className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>
      {error && <AuthBanner code={error.code} message={error.message} />}
      {loading && !playlists && <PlaylistListSkeleton />}
      {playlists?.map((p) => {
        const it = items[p.id]
        return (
          <PlaylistPanel
            key={p.id}
            id={p.id}
            title={p.title}
            subtitle={[p.system ? "Private · system playlist" : null, p.count != null ? `${p.count} videos` : null, importLabel(p, locals)].filter(Boolean).join(" · ") || undefined}
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
