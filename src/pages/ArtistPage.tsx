import { useMemo } from "react"
import { Mic2 } from "lucide-react"
import { Page, PageHeader, Section, EmptyState, CardGrid } from "@/components/base/Page"
import { PlayAllButton, ShuffleAllButton } from "@/components/base/HeaderActions"
import { SongList } from "@/components/song/SongRow"
import { AlbumCard } from "@/components/cards/AlbumCard"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { buildArtist } from "@/lib/catalog"
import type { QueueContext } from "@/player/queue"

export default function ArtistPage({ name }: { name: string }) {
  const songs = useLibraryStore((s) => s.songs)
  const albums = useLibraryStore((s) => s.albums)
  const artist = useMemo(() => buildArtist(songs, albums, name), [songs, albums, name])
  const context = useMemo<QueueContext>(() => ({ type: "artist", id: name.toLowerCase(), label: artist?.artist_name ?? name }), [name, artist?.artist_name])
  if (!artist) return <EmptyState icon={Mic2} title={`No songs by ${name}`} hint="Songs by this artist may have been removed." />
  return (
    <Page>
      <PageHeader
        eyebrow="Artist"
        title={artist.artist_name}
        artwork={artist.artist_thumbnail}
        icon={Mic2}
        colorKey={`artist:${artist.key}`}
        meta={
          <span>
            {artist.artist_songs.length} {artist.artist_songs.length === 1 ? "song" : "songs"} · {artist.artist_albums.length} {artist.artist_albums.length === 1 ? "album" : "albums"}
          </span>
        }
        actions={
          <>
            <PlayAllButton songs={artist.artist_songs} context={context} />
            <ShuffleAllButton songs={artist.artist_songs} context={context} />
          </>
        }
      />
      {artist.artist_albums.length > 0 && (
        <Section title="Albums">
          <CardGrid>
            {artist.artist_albums.map((a) => (
              <AlbumCard key={a.key} album={a} />
            ))}
          </CardGrid>
        </Section>
      )}
      <Section title="Songs">
        <SongList songs={artist.artist_songs} queueContext={context} />
      </Section>
    </Page>
  )
}
