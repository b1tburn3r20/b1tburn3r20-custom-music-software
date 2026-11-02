import { Fragment, useEffect, useMemo } from "react"
import { History } from "lucide-react"
import { Page, PageHeader, Section, EmptyState } from "@/components/base/Page"
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

  return (
    <Page>
      <PageHeader eyebrow="History" title="Recently played" icon={History} colorKey="history" actions={<Button variant="secondary" onClick={() => navigate({ name: "stats" })}>Listening stats</Button>} />
      {empty && <EmptyState icon={History} title="Nothing played yet" />}
      {groups.map((g) => (
        <Section key={g.label} title={g.label} className="pt-0">
          {g.rows.map((r) => (
            <Fragment key={r.key}>
              <SongRow song={r.song} variant="row" list={listSongs} queueContext={CONTEXT} badge={`${new Date(r.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · ${formatListening(r.listenedMs)}${r.counted ? "" : " · skipped"}`} />
            </Fragment>
          ))}
        </Section>
      ))}
      {legacySongs.length > 0 && (
        <Section title="Earlier" className="pt-0">
          <p className="mb-2 text-sm text-muted-foreground">Played before listening stats were tracked (no dates).</p>
          {legacySongs.map((s) => (
            <SongRow key={s.id} song={s} list={legacySongs} queueContext={CONTEXT} />
          ))}
        </Section>
      )}
    </Page>
  )
}
