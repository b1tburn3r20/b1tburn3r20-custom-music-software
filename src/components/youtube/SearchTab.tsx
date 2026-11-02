import { useEffect, useRef, useState } from "react"
import { ListMusic, Loader2, Search, Youtube } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/base/Page"
import { useYoutubeStore } from "@/components/youtube/searchStore"
import { parseYoutubeUrl, playlistWithVideos, searchPlaylists, searchVideos, videoDetails, type YtPlaylist, type YtVideo } from "@/lib/youtubeApi"
import { VideoCard } from "./VideoCard"
import { PlaylistPanel } from "./PlaylistPanel"
import { useOwnedIndex } from "./useOwned"

/** Public YouTube search (videos or playlists), or paste a video/playlist link. */
export function SearchTab() {
  const term = useYoutubeStore((s) => s.searchTerm)
  const setTerm = useYoutubeStore((s) => s.setSearchTerm)
  const playlistMode = useYoutubeStore((s) => s.playlists)
  const setPlaylistMode = useYoutubeStore((s) => s.setPlaylists)
  const trigger = useYoutubeStore((s) => s.triggerSearchKey)
  const safeSearch = useYoutubeStore((s) => s.safeSearch)
  const setSafeSearch = useYoutubeStore((s) => s.setSafeSearch)
  const musicOnly = useYoutubeStore((s) => s.musicCategoryOnly)
  const setMusicOnly = useYoutubeStore((s) => s.setMusicCategoryOnly)
  const [videos, setVideos] = useState<YtVideo[] | null>(null)
  const [playlists, setPlaylists] = useState<YtPlaylist[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const owned = useOwnedIndex()
  const inputRef = useRef<HTMLInputElement>(null)

  const run = async (q = term) => {
    const query = q.trim()
    if (!query) return
    setLoading(true)
    setError(null)
    try {
      const link = parseYoutubeUrl(query)
      if (link.playlistId) {
        setPlaylists([await playlistWithVideos(link.playlistId)])
        setVideos(null)
      } else if (link.videoId) {
        setVideos(await videoDetails([link.videoId]))
        setPlaylists(null)
      } else if (playlistMode) {
        setPlaylists(await searchPlaylists(query, { safeSearch, musicOnly }))
        setVideos(null)
      } else {
        setVideos(await searchVideos(query, { safeSearch, musicOnly }))
        setPlaylists(null)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (trigger) void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void run()
        }}
      >
        <div className="relative min-w-72 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input ref={inputRef} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search YouTube, or paste a video / playlist link" className="pl-9" aria-label="Search YouTube" spellCheck={false} />
        </div>
        <div role="radiogroup" aria-label="Search for" className="flex rounded-md bg-muted p-0.5">
          <Button type="button" role="radio" aria-checked={!playlistMode} size="sm" variant={playlistMode ? "ghost" : "secondary"} onClick={() => setPlaylistMode(false)}>
            <Youtube /> Videos
          </Button>
          <Button type="button" role="radio" aria-checked={playlistMode} size="sm" variant={playlistMode ? "secondary" : "ghost"} onClick={() => setPlaylistMode(true)}>
            <ListMusic /> Playlists
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="yt-music-only" checked={musicOnly} onCheckedChange={setMusicOnly} />
          <Label htmlFor="yt-music-only">Music only</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="yt-safe" checked={safeSearch} onCheckedChange={setSafeSearch} />
          <Label htmlFor="yt-safe">Safe search</Label>
        </div>
        <Button type="submit" variant="youtube" disabled={!term.trim() || loading}>
          {loading ? <Loader2 className="animate-spin" /> : <Search />} Search
        </Button>
      </form>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {loading && <p className="py-12 text-center text-muted-foreground">Searching…</p>}
      {!loading && videos && (videos.length ? (
        <div className="flex flex-wrap justify-center gap-4">
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} owned={owned(v)} />
          ))}
        </div>
      ) : <EmptyState icon={Youtube} title="No videos found" />)}
      {!loading && playlists && (playlists.length ? (
        <div className="flex flex-col gap-3">
          {playlists.map((p) => (
            <PlaylistPanel key={p.id} id={p.id} title={p.title} subtitle={p.channel} thumbnail={p.thumbnail} videos={p.videos} defaultOpen={playlists.length === 1} />
          ))}
        </div>
      ) : <EmptyState icon={ListMusic} title="No playlists found" />)}
      {!loading && !videos && !playlists && !error && <EmptyState icon={Youtube} title="Search YouTube to download music" hint="Songs you already have show up in green. Paste a link to jump straight to a video or playlist." />}
    </div>
  )
}
