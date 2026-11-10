import { useMemo } from "react"
import { Download } from "lucide-react"
import { Container, Page, PageHeader, EmptyState } from "@/components/base/Page"
import { VirtualList } from "@/components/base/VirtualList"
import { PlayAllButton, ShuffleAllButton, TagAllButton } from "@/components/base/HeaderActions"
import { SongRow } from "@/components/song/SongRow"
import { Button } from "@/components/ui/button"
import { resolveSongs, useLibraryStore } from "@/stores/useLibraryStore"
import { useUserStore } from "@/stores/useUserStore"
import { navigate } from "@/stores/useAppStore"
import { dayLabel } from "@/lib/time"
import { formatDuration } from "@/utils/textUtils"
import type { QueueContext } from "@/player/queue"
import type { Song } from "@/types/DirectoryTypes"

const CONTEXT: QueueContext = { type: "downloads", label: "Downloads" }

type DownloadRow = { kind: "heading"; key: string; label: string; first: boolean } | { kind: "song"; key: string; song: Song; at: number | null }

function DownloadRowView({ row: r, list }: { row: DownloadRow; list: readonly Song[] }) {
  if (r.kind === "heading")
    return (
      <div className={r.first ? "" : "pt-6"}>
        <h2 className="mb-4 truncate text-2xl font-bold tracking-tight">{r.label}</h2>
        {r.label === "Earlier" && <p className="mb-2 text-sm text-muted-foreground">No download date recorded.</p>}
      </div>
    )
  return <SongRow song={r.song} variant="row" list={list} queueContext={CONTEXT} badge={r.at ? new Date(r.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : undefined} />
}

/**
 * Everything downloaded from YouTube, newest first, grouped by day.
 * Deleted songs drop out automatically: they're purged from the list in main,
 * and anything not in the library (e.g. a file removed from disk) never resolves.
 */
export default function DownloadsPage() {
  const ids = useUserStore((s) => s.recentlyDownloaded)
  const downloadedAt = useUserStore((s) => s.downloadedAt)
  const byId = useLibraryStore((s) => s.songsById)

  const songs = useMemo(() => resolveSongs(ids, byId), [ids, byId])
  const total = useMemo(() => songs.reduce((a, s) => a + (s.metadata.duration || 0), 0), [songs])

  // Day headings + songs as one flat list, so the whole history can be virtualized.
  const rows = useMemo(() => {
    const out: DownloadRow[] = []
    let label: string | null = null
    songs.forEach((song, i) => {
      // Downloads from before dates were tracked: the file's creation time is a close stand-in.
      const at = downloadedAt[song.id] ?? (song.addedAt || null)
      const day = at ? dayLabel(at) : "Earlier"
      if (day !== label) out.push({ kind: "heading", key: `h:${out.length}:${day}`, label: day, first: label === null })
      label = day
      out.push({ kind: "song", key: `${song.id}:${i}`, song, at })
    })
    return out
  }, [songs, downloadedAt])

  return (
    <Page>
      <PageHeader
        eyebrow="History"
        title="Downloads"
        icon={Download}
        colorKey="downloads"
        meta={songs.length ? <span>{songs.length} {songs.length === 1 ? "song" : "songs"} · {formatDuration(total)}</span> : undefined}
        actions={
          <>
            <PlayAllButton songs={songs} context={CONTEXT} />
            <ShuffleAllButton songs={songs} context={CONTEXT} />
            <TagAllButton songs={songs} />
          </>
        }
      />
      {!songs.length && <EmptyState icon={Download} title="Nothing downloaded yet" hint="Songs you download from YouTube show up here." action={<Button onClick={() => navigate({ name: "youtube" })}>Open YouTube</Button>} />}
      {rows.length > 0 && (
        <Container className="pb-6">
          <VirtualList items={rows} getKey={(r) => r.key} estimateSize={(r) => (r.kind === "song" ? 56 : 64)} renderItem={(r) => <DownloadRowView row={r} list={songs} />} />
        </Container>
      )}
    </Page>
  )
}
