import { useMemo, useState } from "react"
import { Download } from "lucide-react"
import { Page, Section, CardGrid, EmptyState } from "@/components/base/Page"
import { SongRow } from "@/components/song/SongRow"
import { PlaylistCard } from "@/components/cards/PlaylistCard"
import { DiceButton } from "@/components/cards/DiceButton"
import { Button } from "@/components/ui/button"
import { resolveSongs, useLibraryStore } from "@/stores/useLibraryStore"
import { useUserStore } from "@/stores/useUserStore"
import { navigate } from "@/stores/useAppStore"
import { shuffled } from "@/lib/catalog"
import type { QueueContext } from "@/player/queue"
import type { Song } from "@/types/DirectoryTypes"

const DOWNLOADS: QueueContext = { type: "downloads", label: "Recently downloaded" }
const RECENT: QueueContext = { type: "history", label: "Listen again" }
const PICKS: QueueContext = { type: "list", id: "random-picks", label: "Random picks" }

function SongCardGrid({ songs, context, initial = 8 }: { songs: Song[]; context: QueueContext; initial?: number }) {
  const [count, setCount] = useState(initial)
  return (
    <>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {songs.slice(0, count).map((s) => (
          <SongRow key={s.id} song={s} variant="card" list={songs} queueContext={context} />
        ))}
      </div>
      {songs.length > count && (
        <Button variant="ghost" className="mt-2 w-full text-muted-foreground" onClick={() => setCount((c) => c + 16)}>
          Show more
        </Button>
      )}
    </>
  )
}

export default function HomePage() {
  const byId = useLibraryStore((s) => s.songsById)
  const all = useLibraryStore((s) => s.songs)
  const loaded = useLibraryStore((s) => s.loaded)
  const recentlyDownloaded = useUserStore((s) => s.recentlyDownloaded)
  const recentlyPlayed = useUserStore((s) => s.recentlyPlayed)
  const recentPlaylistIds = useUserStore((s) => s.recentPlaylists)
  const playlists = useUserStore((s) => s.playlists)

  const downloads = useMemo(() => resolveSongs(recentlyDownloaded, byId), [recentlyDownloaded, byId])
  const listenAgain = useMemo(() => resolveSongs(recentlyPlayed.map((r) => r.songId), byId).slice(0, 9), [recentlyPlayed, byId])
  const recentPlaylists = useMemo(() => recentPlaylistIds.map((id) => playlists.find((p) => p.id === id)).filter((p) => p !== undefined).slice(0, 9), [recentPlaylistIds, playlists])
  // Stable per session: reshuffled only when songs are added/removed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const picks = useMemo(() => shuffled(all).slice(0, 48), [all.length])

  if (loaded && !all.length) {
    return <EmptyState icon={Download} title="Your library is empty" hint="Pick a music folder in Settings, or download songs from YouTube." action={<Button onClick={() => navigate({ name: "youtube" })}>Open YouTube</Button>} />
  }

  return (
    <Page>
      {downloads.length > 0 && (
        <Section title="Recently downloaded">
          <SongCardGrid songs={downloads} context={DOWNLOADS} />
        </Section>
      )}
      {listenAgain.length > 0 && (
        <Section title="Listen again" action={<Button variant="link" onClick={() => navigate({ name: "history" })}>See all</Button>}>
          <CardGrid className="md:grid-cols-5 xl:grid-cols-5">
            {listenAgain.slice(0, 4).map((s) => (
              <SongRow key={s.id} song={s} variant="tile" list={listenAgain} queueContext={RECENT} />
            ))}
            <div className="p-3">
              <DiceButton kind="song" />
            </div>
            {listenAgain.slice(4).map((s) => (
              <SongRow key={s.id} song={s} variant="tile" list={listenAgain} queueContext={RECENT} />
            ))}
          </CardGrid>
        </Section>
      )}
      {recentPlaylists.length > 0 && (
        <Section title="Recently played playlists">
          <CardGrid className="md:grid-cols-5 xl:grid-cols-5">
            {recentPlaylists.slice(0, 4).map((p) => (
              <PlaylistCard key={p.id} playlist={p} />
            ))}
            <div className="p-3">
              <DiceButton kind="playlist" />
            </div>
            {recentPlaylists.slice(4).map((p) => (
              <PlaylistCard key={p.id} playlist={p} />
            ))}
          </CardGrid>
        </Section>
      )}
      <Section title="Random picks">
        <SongCardGrid songs={picks} context={PICKS} initial={16} />
      </Section>
    </Page>
  )
}
