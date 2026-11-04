import { useMemo } from "react"
import { Disc3 } from "lucide-react"
import { Page, PageHeader, Section, EmptyState } from "@/components/base/Page"
import { PlayAllButton, ShuffleAllButton, TagAllButton } from "@/components/base/HeaderActions"
import { SongList } from "@/components/song/SongRow"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { navigate } from "@/stores/useAppStore"
import { formatDuration } from "@/utils/textUtils"
import type { QueueContext } from "@/player/queue"

export default function AlbumPage({ albumKey }: { albumKey: string }) {
  const album = useLibraryStore((s) => s.albums.find((a) => a.key === albumKey))
  const context = useMemo<QueueContext>(() => ({ type: "album", id: albumKey, label: album?.album_name ?? "Album" }), [albumKey, album?.album_name])
  if (!album) return <EmptyState icon={Disc3} title="Album not found" hint="Its songs may have been removed from your library." />
  const songs = album.album_songs
  const total = songs.reduce((a, s) => a + (s.metadata.duration || 0), 0)
  const artists = album.album_artists
  return (
    <Page>
      <PageHeader
        eyebrow="Album"
        title={album.album_name}
        artwork={album.album_thumbnail}
        icon={Disc3}
        colorKey={album.key}
        meta={
          <>
            {artists.length >= 5 ? (
              <span>Various artists</span>
            ) : (
              artists.map((a, i) => (
                <span key={a}>
                  <button type="button" className="font-semibold hover:underline" onClick={() => navigate({ name: "artist", artist: a })}>
                    {a}
                  </button>
                  {i < artists.length - 1 && ","}
                </span>
              ))
            )}
            {album.album_release_date.length > 0 && <span>· {album.album_release_date.join(", ")}</span>}
            <span>
              · {songs.length} {songs.length === 1 ? "song" : "songs"} · {formatDuration(total)}
            </span>
          </>
        }
        actions={
          <>
            <PlayAllButton songs={songs} context={context} />
            <ShuffleAllButton songs={songs} context={context} />
            <TagAllButton songs={songs} />
          </>
        }
      />
      <Section>
        <SongList songs={songs} queueContext={context} />
      </Section>
    </Page>
  )
}
