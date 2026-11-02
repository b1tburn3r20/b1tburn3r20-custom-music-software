import { useCallback, useEffect, useState } from "react"
import { RefreshCcw, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/base/Page"
import { ApiError, call } from "@/lib/api"
import type { MyYoutubePlaylist } from "@/types/api"
import { useUserStore } from "@/stores/useUserStore"
import { openSettings } from "@/app/settings/settingsStore"
import { PlaylistPanel } from "./PlaylistPanel"
import { AuthBanner } from "./AuthBanner"

/** The signed-in user's own YouTube playlists (including private ones and Liked videos). */
export function MyPlaylists() {
  const mode = useUserStore((s) => s.settings.youtubeAuth.mode)
  const [playlists, setPlaylists] = useState<MyYoutubePlaylist[] | null>(null)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPlaylists(await call(window.api.youtube.myPlaylists()))
    } catch (err) {
      setError({ code: err instanceof ApiError ? err.code : "ERROR", message: (err as Error).message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mode !== "none") void load()
  }, [mode, load])

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
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCcw className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>
      {error && <AuthBanner code={error.code} message={error.message} />}
      {playlists?.map((p) => (
        <PlaylistPanel
          key={p.id}
          id={p.id}
          title={p.title}
          subtitle={p.system ? "Private · system playlist" : p.count != null ? `${p.count} videos` : undefined}
          thumbnail={p.thumbnail}
          load={async () => (await call(window.api.youtube.playlistItems(p.id))).videos}
        />
      ))}
    </div>
  )
}
