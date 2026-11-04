import { useMemo } from "react"
import { Library } from "lucide-react"
import { Page, PageHeader, Section, CardGrid, EmptyState } from "@/components/base/Page"
import { PlayAllButton, ShuffleAllButton } from "@/components/base/HeaderActions"
import { SongList } from "@/components/song/SongRow"
import { AlbumCard } from "@/components/cards/AlbumCard"
import { ArtistCard } from "@/components/cards/ArtistCard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { navigate } from "@/stores/useAppStore"
import { buildArtistList, buildTagList } from "@/lib/catalog"
import { useUserStore } from "@/stores/useUserStore"
import { TagCard } from "@/components/cards/TagCard"
import type { QueueContext } from "@/player/queue"

const CONTEXT: QueueContext = { type: "list", id: "library", label: "Library" }

export default function LibraryPage({ tab = "albums" }: { tab?: "albums" | "artists" | "songs" | "tags" }) {
  const songs = useLibraryStore((s) => s.songs)
  const albums = useLibraryStore((s) => s.albums)
  const artists = useMemo(() => buildArtistList(songs), [songs])
  const songTags = useUserStore((s) => s.songTags)
  const tags = useMemo(() => buildTagList(songs, songTags), [songs, songTags])
  const byTitle = useMemo(() => [...songs].sort((a, b) => a.metadata.title.localeCompare(b.metadata.title)), [songs])
  return (
    <Page>
      <PageHeader
        eyebrow="Library"
        title="Your music"
        icon={Library}
        colorKey="library"
        meta={<span>{songs.length} songs · {albums.length} albums · {artists.length} artists</span>}
        actions={
          <>
            <PlayAllButton songs={byTitle} context={CONTEXT} />
            <ShuffleAllButton songs={byTitle} context={CONTEXT} />
          </>
        }
      />
      <Section>
        <Tabs value={tab} onValueChange={(v) => navigate({ name: "library", tab: v as typeof tab }, { replace: true })}>
          <TabsList>
            <TabsTrigger value="albums">Albums</TabsTrigger>
            <TabsTrigger value="artists">Artists</TabsTrigger>
            <TabsTrigger value="songs">Songs</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
          </TabsList>
          <TabsContent value="albums" className="pt-4">
            {albums.length ? <CardGrid>{albums.map((a) => <AlbumCard key={a.key} album={a} />)}</CardGrid> : <EmptyState icon={Library} title="No albums yet" hint="Songs with album tags show up here." />}
          </TabsContent>
          <TabsContent value="artists" className="pt-4">
            <CardGrid>{artists.map((a) => <ArtistCard key={a.key} name={a.name} thumbnail={a.thumbnail} songCount={a.songCount} />)}</CardGrid>
          </TabsContent>
          <TabsContent value="tags" className="pt-4">
            {tags.length ? <CardGrid>{tags.map((t) => <TagCard key={t.key} name={t.name} count={t.count} own={t.own} thumbnail={t.thumbnail} />)}</CardGrid> : <EmptyState icon={Library} title="No tags yet" hint="Right-click a song and choose Tags… to tag it with a mood or genre like “somber” or “rap”." />}
          </TabsContent>
          <TabsContent value="songs" className="pt-4">
            <SongList songs={byTitle} startRadio queueContext={CONTEXT} />
          </TabsContent>
        </Tabs>
      </Section>
    </Page>
  )
}
