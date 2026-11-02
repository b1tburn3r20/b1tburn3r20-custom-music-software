import { useMemo } from "react"
import { Search } from "lucide-react"
import { Page, PageHeader, Section, EmptyState, CardGrid } from "@/components/base/Page"
import { PlayAllButton } from "@/components/base/HeaderActions"
import { SongList } from "@/components/song/SongRow"
import { AlbumCard } from "@/components/cards/AlbumCard"
import { ArtistCard } from "@/components/cards/ArtistCard"
import { Button } from "@/components/ui/button"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { buildArtistList, searchSongs } from "@/lib/catalog"
import { navigate } from "@/stores/useAppStore"
import { useYoutubeStore } from "@/components/youtube/searchStore"
import { useYoutubeTab } from "@/components/youtube/tabStore"
import type { QueueContext } from "@/player/queue"

const lc = (s: string) => s.toLowerCase()

export default function SearchPage({ q }: { q: string }) {
  const songs = useLibraryStore((s) => s.songs)
  const albums = useLibraryStore((s) => s.albums)
  const words = useMemo(() => lc(q).split(/\s+/).filter(Boolean), [q])
  const songHits = useMemo(() => searchSongs(songs, q), [songs, q])
  const albumHits = useMemo(() => albums.filter((a) => words.length && words.every((w) => lc(`${a.album_name} ${a.album_artists.join(" ")}`).includes(w))), [albums, words])
  const artistHits = useMemo(() => buildArtistList(songs).filter((a) => words.length && words.every((w) => a.key.includes(w))), [songs, words])
  const context = useMemo<QueueContext>(() => ({ type: "search", id: q, label: `Search: ${q}` }), [q])

  const searchYouTube = () => {
    const yt = useYoutubeStore.getState()
    yt.setSearchTerm(q)
    yt.setPlaylists(false)
    yt.incrementTriggerSearchKey()
    useYoutubeTab.getState().setTab("search")
  navigate({ name: "youtube" })
  }

  const nothing = !songHits.length && !albumHits.length && !artistHits.length
  return (
    <Page>
      <PageHeader
        eyebrow="Search"
        title={`“${q}”`}
        icon={Search}
        colorKey="search"
        meta={<span>{songHits.length} songs · {albumHits.length} albums · {artistHits.length} artists</span>}
        actions={
          <>
            <PlayAllButton songs={songHits} context={context} />
            <Button variant="secondary" onClick={searchYouTube}>Search YouTube for “{q}”</Button>
          </>
        }
      />
      {nothing && <EmptyState icon={Search} title={`No results for “${q}”`} hint="Try fewer or different words, or search YouTube." />}
      {artistHits.length > 0 && (
        <Section title="Artists">
          <CardGrid>
            {artistHits.slice(0, 12).map((a) => (
              <ArtistCard key={a.key} name={a.name} thumbnail={a.thumbnail} songCount={a.songCount} />
            ))}
          </CardGrid>
        </Section>
      )}
      {albumHits.length > 0 && (
        <Section title="Albums">
          <CardGrid>
            {albumHits.slice(0, 12).map((a) => (
              <AlbumCard key={a.key} album={a} />
            ))}
          </CardGrid>
        </Section>
      )}
      {songHits.length > 0 && (
        <Section title="Songs">
          <SongList songs={songHits} queueContext={context} />
        </Section>
      )}
    </Page>
  )
}
