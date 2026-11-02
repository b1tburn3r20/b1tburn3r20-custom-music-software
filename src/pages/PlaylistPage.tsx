import { useMemo, useState } from "react"
import { ListMusic, ListPlus, Pencil, Trash2 } from "lucide-react"
import { Page, PageHeader, Section, EmptyState } from "@/components/base/Page"
import { IconAction, PlayAllButton, ShuffleAllButton } from "@/components/base/HeaderActions"
import { SongList } from "@/components/song/SongRow"
import { Button } from "@/components/ui/button"
import { resolveSongs, useLibraryStore } from "@/stores/useLibraryStore"
import { useUserStore } from "@/stores/useUserStore"
import { dialogs } from "@/stores/useDialogStore"
import { formatDuration } from "@/utils/textUtils"
import AddSongsDialog from "@/components/dialogs/AddSongsDialog"
import type { QueueContext } from "@/player/queue"

export default function PlaylistPage({ id }: { id: string }) {
  const playlist = useUserStore((s) => s.playlists.find((p) => p.id === id))
  const byId = useLibraryStore((s) => s.songsById)
  const songs = useMemo(() => (playlist ? resolveSongs(playlist.songIds, byId) : []), [playlist, byId])
  const [adding, setAdding] = useState(false)
  const context = useMemo<QueueContext>(() => ({ type: "playlist", id, label: playlist?.name ?? "Playlist" }), [id, playlist?.name])

  if (!playlist) return <EmptyState icon={ListMusic} title="Playlist not found" hint="It may have been deleted." />
  const total = songs.reduce((a, s) => a + (s.metadata.duration || 0), 0)
  const missing = playlist.songIds.length - songs.length + (playlist.unresolvedPaths?.length ?? 0)

  return (
    <Page>
      <PageHeader
        eyebrow="Playlist"
        title={playlist.name}
        description={playlist.description}
        artwork={songs[0]?.metadata.thumbnail ?? null}
        icon={ListMusic}
        colorKey={playlist.id}
        meta={
          <>
            <span>
              {songs.length} {songs.length === 1 ? "song" : "songs"}
            </span>
            <span aria-hidden>·</span>
            <span>{formatDuration(total)}</span>
            {missing > 0 && <span className="text-muted-foreground">({missing} unavailable)</span>}
          </>
        }
        actions={
          <>
            <PlayAllButton songs={songs} context={context} />
            <ShuffleAllButton songs={songs} context={context} />
            <IconAction icon={ListPlus} label="Add songs" onClick={() => setAdding(true)} />
            <IconAction icon={Pencil} label="Edit details" onClick={() => dialogs().openPlaylistForm({ mode: "edit", playlistId: id })} />
            <IconAction icon={Trash2} label="Delete playlist" onClick={() => dialogs().confirmDeletePlaylist(id)} />
          </>
        }
      />
      <Section>
        {songs.length ? (
          <SongList songs={songs} queueContext={context} playlistId={id} />
        ) : (
          <EmptyState icon={ListMusic} title="This playlist is empty" hint="Add songs from your library, or right-click any song and choose Add to playlist." action={<Button onClick={() => setAdding(true)}><ListPlus /> Add songs</Button>} />
        )}
      </Section>
      <AddSongsDialog playlistId={id} open={adding} onOpenChange={setAdding} />
    </Page>
  )
}
