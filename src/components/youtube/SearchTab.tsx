import { useEffect, useRef } from "react"
import { Link2, ListMusic, Loader2, Search, X, Youtube } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/base/Page"
import { useYoutubeStore } from "@/components/youtube/searchStore"
import { parseYoutubeUrl } from "@/lib/youtubeApi"
import { VideoCard } from "./VideoCard"
import { PlaylistPanel } from "./PlaylistPanel"
import { useOwnedIndex } from "./useOwned"
import { useYoutubeTab } from "./tabStore"
import { VideoGridSkeleton } from "./Skeletons"
import { SearchOption } from "./YoutubeUnlock"

/** What the box will do with what's typed. */
function intentOf(term: string) {
  const link = parseYoutubeUrl(term)
  if (link.playlistId) return { isLink: true, action: "Open playlist" }
  if (link.videoId) return { isLink: true, action: "Open video" }
  return { isLink: false, action: "Search" }
}

/** One box for everything: words, a video link or id, or a playlist link. Always at the top of the page. */
export function YoutubeSearchBar() {
  const term = useYoutubeStore((s) => s.searchTerm)
  const setTerm = useYoutubeStore((s) => s.setSearchTerm)
  const trigger = useYoutubeStore((s) => s.triggerSearchKey)
  const searching = useYoutubeStore((s) => s.searching)
  const runSearch = useYoutubeStore((s) => s.runSearch)
  const setTab = useYoutubeTab((s) => s.setTab)
  const inputRef = useRef<HTMLInputElement>(null)
  const { isLink, action } = intentOf(term)

  const go = (value?: string) => {
    if (!(value ?? term).trim()) return
    setTab("search")
    void runSearch(value)
  }

  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  // A search started from elsewhere in the app, such as the top bar.
  const lastTrigger = useRef(trigger)
  useEffect(() => {
    if (trigger !== lastTrigger.current) {
      lastTrigger.current = trigger
      void runSearch()
    }
  }, [trigger, runSearch])

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        go()
      }}
    >
      <div className="relative min-w-0 flex-1">
        {isLink ? <Link2 className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-primary" aria-hidden /> : <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />}
        <Input
          ref={inputRef}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onPaste={(e) => {
            // Pasting a link is already asking to open it.
            const pasted = e.clipboardData.getData("text").trim()
            if (!term.trim() && intentOf(pasted).isLink) {
              e.preventDefault()
              setTerm(pasted)
              go(pasted)
            }
          }}
          placeholder="Search YouTube, or paste a playlist or video link"
          className="h-12 rounded-xl bg-background-light pl-11 pr-10 text-base md:text-base"
          aria-label="Search YouTube"
          spellCheck={false}
        />
        {term && (
          <button type="button" aria-label="Clear" onClick={() => { setTerm(""); inputRef.current?.focus() }} className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      <Button type="submit" variant="youtube" className="h-12 rounded-xl px-5" disabled={!term.trim() || searching}>
        {searching ? <Loader2 className="animate-spin" /> : isLink ? <Link2 /> : <Search />} {action}
      </Button>
    </form>
  )
}

function Filters() {
  const playlistMode = useYoutubeStore((s) => s.playlists)
  const setPlaylistMode = useYoutubeStore((s) => s.setPlaylists)
  const safeSearch = useYoutubeStore((s) => s.safeSearch)
  const setSafeSearch = useYoutubeStore((s) => s.setSafeSearch)
  const musicOnly = useYoutubeStore((s) => s.musicCategoryOnly)
  const setMusicOnly = useYoutubeStore((s) => s.setMusicCategoryOnly)
  const runSearch = useYoutubeStore((s) => s.runSearch)
  // Changing what's being searched for should change what's shown, with no extra click.
  const again = () => {
    if (useYoutubeStore.getState().searchTerm.trim()) void runSearch()
  }
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div role="radiogroup" aria-label="Search for" className="flex rounded-md bg-muted p-0.5">
        <Button type="button" role="radio" aria-checked={!playlistMode} size="sm" variant={playlistMode ? "ghost" : "secondary"} onClick={() => { setPlaylistMode(false); again() }}>
          <Youtube /> Videos
        </Button>
        <Button type="button" role="radio" aria-checked={playlistMode} size="sm" variant={playlistMode ? "secondary" : "ghost"} onClick={() => { setPlaylistMode(true); again() }}>
          <ListMusic /> Playlists
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="yt-music-only" checked={musicOnly} onCheckedChange={(v) => { setMusicOnly(v); again() }} />
        <Label htmlFor="yt-music-only">Music only</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="yt-safe" checked={safeSearch} onCheckedChange={(v) => { setSafeSearch(v); again() }} />
        <Label htmlFor="yt-safe">Safe search</Label>
      </div>
    </div>
  )
}

/** What came back from the search box. */
export function SearchResults() {
  const videos = useYoutubeStore((s) => s.videoResults)
  const playlists = useYoutubeStore((s) => s.playlistResults)
  const loading = useYoutubeStore((s) => s.searching)
  const error = useYoutubeStore((s) => s.searchError)
  const needsKey = useYoutubeStore((s) => s.needsKey)
  const term = useYoutubeStore((s) => s.searchTerm)
  const owned = useOwnedIndex()
  const isLink = intentOf(term).isLink

  return (
    <div className="flex flex-col gap-4">
      {!isLink && <Filters />}
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {needsKey && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Searching by words needs an API key. Playlist and video links work without one, so you can paste a link instead.</p>
          <SearchOption />
        </div>
      )}
      {loading && <VideoGridSkeleton />}
      {!loading && videos && (videos.length ? (
        <div className="flex flex-wrap justify-center gap-4">
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} owned={owned(v)} />
          ))}
        </div>
      ) : <EmptyState icon={Youtube} title="No videos found" hint="Try different words, or paste a link." />)}
      {!loading && playlists && (playlists.length ? (
        <div className="flex flex-col gap-3">
          {playlists.map((p) => (
            <PlaylistPanel key={p.id} id={p.id} title={p.title} subtitle={p.channel} thumbnail={p.thumbnail} videos={p.videos} defaultOpen={playlists.length === 1} />
          ))}
        </div>
      ) : <EmptyState icon={ListMusic} title="No playlists found" hint="Try different words, or paste a link." />)}
      {!loading && !videos && !playlists && !error && !needsKey && <EmptyState icon={Search} title="Nothing searched yet" hint="Use the box above. Songs you already have show up in green." />}
    </div>
  )
}
