import { useMemo } from "react"
import { Search } from "lucide-react"
import { Page, PageHeader, Section, EmptyState, CardGrid } from "@/components/base/Page"
import { PlayAllButton, TagAllButton } from "@/components/base/HeaderActions"
import { SongList } from "@/components/song/SongRow"
import { AlbumCard } from "@/components/cards/AlbumCard"
import { ArtistCard } from "@/components/cards/ArtistCard"
import { Button } from "@/components/ui/button"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { buildArtistList, buildTagList, searchAlbums, searchArtists, searchSongs } from "@/lib/catalog"
import { useUserStore } from "@/stores/useUserStore"
import { TagCard } from "@/components/cards/TagCard"
import { navigate } from "@/stores/useAppStore"
import { useYoutubeStore } from "@/components/youtube/searchStore"
import { useYoutubeTab } from "@/components/youtube/tabStore"
import type { QueueContext } from "@/player/queue"

export default function SearchPage({ q }: { q: string }) {
  const songs = useLibraryStore((s) => s.songs)
  const albums = useLibraryStore((s) => s.albums)
  const songHits = useMemo(() => searchSongs(songs, q), [songs, q])
  const albumHits = useMemo(() => searchAlbums(albums, q), [albums, q])
  const artistHits = useMemo(() => searchArtists(buildArtistList(songs), q), [songs, q])
  const songTags = useUserStore((s) => s.songTags)
  const tagHits = useMemo(() => {
    const k = q.trim().toLowerCase()
    return k ? buildTagList(songs, songTags).filter((t) => t.key.includes(k)).slice(0, 12) : []
  }, [songs, songTags, q])
  const context = useMemo<QueueContext>(() => ({ type: "search", id: q, label: `Search: ${q}` }), [q])

  const searchYouTube = () => {
    const yt = useYoutubeStore.getState()
    yt.setSearchTerm(q)
    yt.setPlaylists(false)
    yt.incrementTriggerSearchKey()
    useYoutubeTab.getState().setTab("search")
  navigate({ name: "youtube" })
  }

  const nothing = !songHits.length && !albumHits.length && !artistHits.length && !tagHits.length
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
            <TagAllButton songs={songHits} />
            <Button variant="secondary" onClick={searchYouTube}>Search YouTube for “{q}”</Button>
          </>
        }
      />
      {nothing && <EmptyState icon={Search} title={`No results for “${q}”`} hint="Try fewer or different words, or search YouTube." />}
      {tagHits.length > 0 && (
        <Section title="Tags">
          <CardGrid>
            {tagHits.map((t) => (
              <TagCard key={t.key} name={t.name} count={t.count} own={t.own} thumbnail={t.thumbnail} />
            ))}
          </CardGrid>
        </Section>
      )}
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
          <SongList songs={songHits} startRadio queueContext={context} />
        </Section>
      )}
    </Page>
  )
}
