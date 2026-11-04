import { memo, useEffect, useMemo, useState } from "react"
import { Download, Heart, ListMusic, Pause, Play, RefreshCw, Shuffle } from "lucide-react"
import { Container, EmptyState, Page } from "@/components/base/Page"
import { Artwork } from "@/components/base/Artwork"
import { AutoGrid } from "@/components/base/AutoGrid"
import { IconButton } from "@/components/base/IconButton"
import { SongRow } from "@/components/song/SongRow"
import { DiceButton } from "@/components/cards/DiceButton"
import { HomeSection } from "@/components/home/HomeSection"
import { HomeStats } from "@/components/home/HomeStats"
import { TagQueue } from "@/components/home/TagQueue"
import { Button } from "@/components/ui/button"
import { buildTagList, shuffled, songsWithTag } from "@/lib/catalog"
import { favorites, quickPicks } from "@/lib/homeFeed"
import { cn } from "@/lib/utils"
import { playContext, playShuffled, togglePlay } from "@/player/controls"
import type { QueueContext } from "@/player/queue"
import { navigate } from "@/stores/useAppStore"
import { resolveSongs, useLibraryStore } from "@/stores/useLibraryStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { useStatsStore } from "@/stores/useStatsStore"
import { useUserStore } from "@/stores/useUserStore"
import type { Playlist } from "@/types/api"
import type { Song } from "@/types/DirectoryTypes"

const QUICK: QueueContext = { type: "list", id: "quick-picks", label: "Quick picks" }
const FAVORITES: QueueContext = { type: "list", id: "favorites", label: "Favorites" }
const DOWNLOADS: QueueContext = { type: "downloads", label: "Recently downloaded" }
const RECENT: QueueContext = { type: "history", label: "Listen again" }
const PICKS: QueueContext = { type: "list", id: "random-picks", label: "Random picks" }
const FORGOTTEN: QueueContext = { type: "list", id: "forgotten-favorites", label: "Forgotten favorites" }
const LIKED: QueueContext = { type: "liked", label: "Liked Songs" }

/** Column widths: compact rows stay readable; tiles stay small so more fit. */
const ROW_WIDTH = 272
const TILE_WIDTH = 124

const SeeAll = ({ onClick }: { onClick: () => void }) => (
  <Button variant="link" size="sm" className="h-8 px-0 text-muted-foreground" onClick={onClick}>
    See all
  </Button>
)

/** Compact songs that reflow with the available width. */
function SongRows({ songs, context, count, badge }: { songs: Song[]; context: QueueContext; count: number; badge?: (song: Song) => string | undefined }) {
  return (
    <AutoGrid
      items={songs}
      minWidth={ROW_WIDTH}
      count={count}
      getKey={(s) => s.id}
      render={(s, i) => <SongRow song={s} variant="compact" startRadio list={songs} index={i} queueContext={context} badge={badge?.(s)} />}
    />
  )
}

const PlaylistRow = memo(function PlaylistRow({ playlist }: { playlist: Playlist }) {
  const byId = useLibraryStore((s) => s.songsById)
  const isThis = usePlayerStore((s) => s.queue.context?.type === "playlist" && s.queue.context.id === playlist.id)
  const playing = usePlayerStore((s) => !s.paused) && isThis
  const open = () => navigate({ name: "playlist", id: playlist.id })
  const cover = byId[playlist.songIds[0]]?.metadata.thumbnail ?? null
  const n = playlist.songIds.length
  return (
    <div role="link" tabIndex={0} onClick={open} onKeyDown={(e) => e.target === e.currentTarget && e.key === "Enter" && open()} className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring">
      {cover ? (
        <Artwork src={cover} size="sm" />
      ) : (
        <div className="flex size-art-sm shrink-0 items-center justify-center rounded-md bg-muted">
          <ListMusic className="size-1/2 text-muted-foreground" aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1 text-sm">
        <p className={cn("truncate font-semibold", isThis && "text-primary")} title={playlist.name}>
          {playlist.name}
        </p>
        <p className="truncate text-muted-foreground">
          {n} {n === 1 ? "song" : "songs"}
        </p>
      </div>
      {n > 0 && (
        <button
          type="button"
          aria-label={playing ? `Pause ${playlist.name}` : `Play ${playlist.name}`}
          onClick={(e) => {
            e.stopPropagation()
            if (isThis) togglePlay()
            else playContext(resolveSongs(playlist.songIds, byId), 0, { type: "playlist", id: playlist.id, label: playlist.name })
          }}
          className={cn("shrink-0 rounded-full bg-primary p-2 text-primary-foreground outline-none transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100", isThis ? "opacity-100" : "opacity-0")}
        >
          {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
        </button>
      )}
    </div>
  )
})

const chip = "inline-flex h-11 items-center gap-2 rounded-lg bg-muted/40 px-3 text-sm font-medium outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"

/** One click to music: the dice, your likes, and mixes from your most used tags. */
function QuickActions({ songs, liked }: { songs: Song[]; liked: Song[] }) {
  const songTags = useUserStore((s) => s.songTags)
  const mixes = useMemo(() => buildTagList(songs, songTags).filter((t) => t.own).slice(0, 6), [songs, songTags])
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DiceButton kind="song" size="small" className="size-11 shrink-0" />
      <DiceButton kind="playlist" size="small" className="size-11 shrink-0" />
      <button type="button" className={chip} disabled={!liked.length} onClick={() => playShuffled(liked, LIKED)}>
        <Heart className="size-4 fill-current text-primary" aria-hidden /> Liked
      </button>
      {mixes.map((t) => (
        <button
          key={t.key}
          type="button"
          className={chip}
          title={`Shuffle the “${t.name}” mix (${t.count} songs)`}
          onClick={() => playShuffled(songsWithTag(songs, t.name, songTags), { type: "list", id: `tag:${t.key}`, label: `${t.name} mix` })}
        >
          <Shuffle className="size-4 text-muted-foreground" aria-hidden /> {t.name}
        </button>
      ))}
    </div>
  )
}

const ago = (ts: number) => {
  const days = Math.round((Date.now() - ts) / 86_400_000)
  return days >= 60 ? `${Math.round(days / 30)}mo ago` : `${days}d ago`
}

export default function HomePage() {
  const byId = useLibraryStore((s) => s.songsById)
  const all = useLibraryStore((s) => s.songs)
  const loaded = useLibraryStore((s) => s.loaded)
  const userLoaded = useUserStore((s) => s.loaded)
  const recentlyDownloaded = useUserStore((s) => s.recentlyDownloaded)
  const recentlyPlayed = useUserStore((s) => s.recentlyPlayed)
  const recentPlaylistIds = useUserStore((s) => s.recentPlaylists)
  const playlists = useUserStore((s) => s.playlists)
  const likes = useUserStore((s) => s.likes)
  const week = useStatsStore((s) => s.byRange.week)
  const allTime = useStatsStore((s) => s.byRange.all)
  const forgotten = useStatsStore((s) => s.forgotten)
  const [pickRound, setPickRound] = useState(0)

  useEffect(() => {
    const stats = useStatsStore.getState()
    stats.load("week").catch(() => {})
    stats.load("all").catch(() => {})
    stats.loadForgotten().catch(() => {})
  }, [])

  // Snapshots: recomputed when the data first arrives or songs come and go, not on
  // every play, so nothing moves while you're reaching for it.
  const statsReady = Boolean(allTime)
  const picks = useMemo(
    () => quickPicks(all, { top: allTime?.topSongs ?? [], likes, recentIds: recentlyPlayed.slice(0, 8).map((r) => r.songId), count: 24 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all.length, statsReady, userLoaded, pickRound],
  )
  const favs = useMemo(
    () => favorites(all, { top: allTime?.topSongs ?? [], likes, count: 48 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all.length, statsReady, userLoaded, likes.length],
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const random = useMemo(() => shuffled(all).slice(0, 96), [all.length])

  const liked = useMemo(() => resolveSongs(likes.map((l) => l.songId), byId), [likes, byId])
  const downloads = useMemo(() => resolveSongs(recentlyDownloaded, byId), [recentlyDownloaded, byId])
  const listenAgain = useMemo(() => resolveSongs(recentlyPlayed.map((r) => r.songId), byId).slice(0, 24), [recentlyPlayed, byId])
  const forgottenInfo = useMemo(() => new Map((forgotten ?? []).map((f) => [f.songId, f])), [forgotten])
  const forgottenSongs = useMemo(() => resolveSongs((forgotten ?? []).map((f) => f.songId), byId), [forgotten, byId])
  const orderedPlaylists = useMemo(() => {
    const recent = recentPlaylistIds.map((id) => playlists.find((p) => p.id === id)).filter((p) => p !== undefined)
    const seen = new Set(recent.map((p) => p.id))
    return [...recent, ...playlists.filter((p) => !seen.has(p.id))]
  }, [recentPlaylistIds, playlists])

  if (loaded && !all.length) {
    return <EmptyState icon={Download} title="Your library is empty" hint="Pick a music folder in Settings, or download songs from YouTube." action={<Button onClick={() => navigate({ name: "youtube" })}>Open YouTube</Button>} />
  }

  return (
    <Page className="pt-3">
      <Container className="flex flex-col gap-2 px-4 @container">
        <HomeStats week={week} all={allTime} />
        <QuickActions songs={all} liked={liked} />
      </Container>

      <HomeSection title="Quick picks" action={<IconButton icon={RefreshCw} size="sm" label="New picks" onClick={() => setPickRound((r) => r + 1)} />}>
        <SongRows songs={picks} context={QUICK} count={9} />
      </HomeSection>

      {favs.length > 0 && (
        <HomeSection title="Favorites" action={<SeeAll onClick={() => navigate({ name: "liked" })} />}>
          <AutoGrid items={favs} minWidth={TILE_WIDTH} count={8} minRows={2} getKey={(s) => s.id} render={(s, i) => <SongRow song={s} variant="tile" hideAlbum startRadio list={favs} index={i} queueContext={FAVORITES} />} />
        </HomeSection>
      )}

      <TagQueue />

      {orderedPlaylists.length > 0 && (
        <HomeSection title="Playlists" action={<SeeAll onClick={() => navigate({ name: "library" })} />}>
          <AutoGrid items={orderedPlaylists} minWidth={ROW_WIDTH} count={6} getKey={(p) => p.id} render={(p) => <PlaylistRow playlist={p} />} />
        </HomeSection>
      )}

      {listenAgain.length > 0 && (
        <HomeSection title="Listen again" action={<SeeAll onClick={() => navigate({ name: "history" })} />}>
          <SongRows songs={listenAgain} context={RECENT} count={6} />
        </HomeSection>
      )}

      {downloads.length > 0 && (
        <HomeSection title="Recently downloaded" action={<SeeAll onClick={() => navigate({ name: "downloads" })} />}>
          <SongRows songs={downloads} context={DOWNLOADS} count={6} />
        </HomeSection>
      )}

      {forgottenSongs.length > 0 && (
        <HomeSection title="Forgotten favorites">
          <SongRows
            songs={forgottenSongs}
            context={FORGOTTEN}
            count={6}
            badge={(s) => {
              const f = forgottenInfo.get(s.id)
              return f && `${f.plays} plays · ${ago(f.lastPlayedAt)}`
            }}
          />
        </HomeSection>
      )}

      <HomeSection title="Random picks">
        <SongRows songs={random} context={PICKS} count={9} />
      </HomeSection>
    </Page>
  )
}
