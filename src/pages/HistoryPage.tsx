import { useEffect, useMemo } from "react"
import { History } from "lucide-react"
import { Container, Page, PageHeader, EmptyState } from "@/components/base/Page"
import { VirtualList } from "@/components/base/VirtualList"
import { SongRow } from "@/components/song/SongRow"
import { Button } from "@/components/ui/button"
import { resolveSongs, useLibraryStore } from "@/stores/useLibraryStore"
import { useUserStore } from "@/stores/useUserStore"
import { useStatsStore } from "@/stores/useStatsStore"
import { navigate } from "@/stores/useAppStore"
import { dayLabel, formatListening } from "@/lib/time"
import type { QueueContext } from "@/player/queue"
import type { Song } from "@/types/DirectoryTypes"

const CONTEXT: QueueContext = { type: "history", label: "History" }

type HistoryRow =
  | { kind: "heading"; key: string; label: string; first: boolean; note?: string }
  | { kind: "song"; key: string; song: Song; list: readonly Song[]; badge?: string }

function renderRow(r: HistoryRow) {
  if (r.kind === "heading")
    return (
      <div className={r.first ? "" : "pt-6"}>
        <h2 className="mb-4 truncate text-2xl font-bold tracking-tight">{r.label}</h2>
        {r.note && <p className="mb-2 text-sm text-muted-foreground">{r.note}</p>}
      </div>
    )
  return <SongRow song={r.song} variant="row" startRadio list={r.list} queueContext={CONTEXT} badge={r.badge} />
}

/** Listening sessions, newest first, grouped by day. Pre-overhaul history (no timestamps) is listed last. */
export default function HistoryPage() {
  const history = useStatsStore((s) => s.history)
  const loadHistory = useStatsStore((s) => s.loadHistory)
  const byId = useLibraryStore((s) => s.songsById)
  const recentlyPlayed = useUserStore((s) => s.recentlyPlayed)

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const groups = useMemo(() => {
    const out: { label: string; rows: { key: string; song: Song; at: number; listenedMs: number; counted: boolean }[] }[] = []
    for (const e of history ?? []) {
      const song = byId[e.songId]
      if (!song) continue
      const label = dayLabel(e.endedAt)
      if (out.at(-1)?.label !== label) out.push({ label, rows: [] })
      out.at(-1)!.rows.push({ key: e.id, song, at: e.endedAt, listenedMs: e.listenedMs, counted: e.counted })
    }
    return out
  }, [history, byId])
  const listSongs = useMemo(() => groups.flatMap((g) => g.rows.map((r) => r.song)), [groups])
  const legacySongs = useMemo(() => resolveSongs(recentlyPlayed.filter((r) => r.legacy).map((l) => l.songId), byId), [recentlyPlayed, byId])
  const empty = history !== null && !groups.length && !legacySongs.length

  // One flat list (day headings + songs) so long histories can be virtualized.
  const rows = useMemo(() => {
    const out: HistoryRow[] = []
    groups.forEach((g, gi) => {
      out.push({ kind: "heading", key: `h:${g.label}`, label: g.label, first: gi === 0 })
      for (const r of g.rows) out.push({ kind: "song", key: r.key, song: r.song, list: listSongs, badge: `${new Date(r.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · ${formatListening(r.listenedMs)}${r.counted ? "" : " · skipped"}` })
    })
    if (legacySongs.length) {
      out.push({ kind: "heading", key: "h:legacy", label: "Earlier", first: !groups.length, note: "Played before listening stats were tracked (no dates)." })
      legacySongs.forEach((s) => out.push({ kind: "song", key: `legacy:${s.id}`, song: s, list: legacySongs }))
    }
    return out
  }, [groups, listSongs, legacySongs])

  return (
    <Page>
      <PageHeader eyebrow="History" title="Recently played" icon={History} colorKey="history" actions={<Button variant="secondary" onClick={() => navigate({ name: "stats" })}>Listening stats</Button>} />
      {empty && <EmptyState icon={History} title="Nothing played yet" />}
      {rows.length > 0 && (
        <Container className="pb-6">
          <VirtualList items={rows} getKey={(r) => r.key} estimateSize={(r) => (r.kind === "song" ? 56 : 64)} renderItem={renderRow} />
        </Container>
      )}
    </Page>
  )
}
