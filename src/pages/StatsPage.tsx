import { useEffect, useMemo, useState } from "react"
import { BarChart3, Mic2 } from "lucide-react"
import { Page, PageHeader, Section, EmptyState } from "@/components/base/Page"
import { Card } from "@/components/base/Layout"
import { SongRow } from "@/components/song/SongRow"
import { Artwork } from "@/components/base/Artwork"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { DailyChart } from "@/components/stats/DailyChart"
import { useStatsStore } from "@/stores/useStatsStore"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { navigate } from "@/stores/useAppStore"
import { formatListening } from "@/lib/time"
import { errorMessage } from "@/lib/api"
import { songArtists } from "@/lib/catalog"
import type { StatsRange } from "@/types/api"
import type { QueueContext } from "@/player/queue"
import type { Song } from "@/types/DirectoryTypes"

const RANGES: { id: StatsRange; label: string; days: number }[] = [
  { id: "week", label: "Last 7 days", days: 7 },
  { id: "month", label: "Last 30 days", days: 30 },
  { id: "all", label: "All time", days: 90 },
]

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-3xl font-bold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </Card>
  )
}

export default function StatsPage() {
  const [range, setRange] = useState<StatsRange>("month")
  const stats = useStatsStore((s) => s.byRange[range])
  const load = useStatsStore((s) => s.load)
  const byId = useLibraryStore((s) => s.songsById)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load(range).catch((e) => setError(errorMessage(e)))
  }, [range, load])

  const top = useMemo(() => (stats?.topSongs ?? []).map((t) => ({ ...t, song: byId[t.songId] })).filter((t): t is typeof t & { song: Song } => Boolean(t.song)).slice(0, 20), [stats, byId])
  const topSongs = useMemo(() => top.map((t) => t.song), [top])
  const artistThumb = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const s of Object.values(byId)) for (const a of songArtists(s)) if (!m.get(a.toLowerCase())) m.set(a.toLowerCase(), s.metadata.thumbnail)
    return m
  }, [byId])
  const context: QueueContext = { type: "list", id: `top-${range}`, label: `Top songs · ${RANGES.find((r) => r.id === range)!.label}` }

  return (
    <Page>
      <PageHeader eyebrow="Stats" title="Your listening" icon={BarChart3} colorKey="stats" meta={<span>A play counts after 30 seconds, or half of a shorter song.</span>} />
      <Section>
        <Tabs value={range} onValueChange={(v) => setRange(v as StatsRange)}>
          <TabsList>
            {RANGES.map((r) => (
              <TabsTrigger key={r.id} value={r.id}>
                {r.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      </Section>
      {stats && stats.totalMs === 0 ? (
        <EmptyState icon={BarChart3} title="No listening recorded in this period" hint="Play some music and your stats will show up here." />
      ) : stats ? (
        <>
          <Section className="pt-0">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Tile label="Listening time" value={formatListening(stats.totalMs)} />
              <Tile label="Plays" value={String(stats.plays)} />
              <Tile label="Songs" value={String(stats.uniqueSongs)} />
              <Tile label="Artists" value={String(stats.uniqueArtists)} />
            </div>
            <Card className="mt-4">
              <DailyChart daily={stats.daily} days={RANGES.find((r) => r.id === range)!.days} />
            </Card>
          </Section>
          <div className="grid gap-2 xl:grid-cols-2">
            <Section title="Most played songs" className="pt-0">
              <div className="flex flex-col">
                {top.map((t, i) => (
                  <SongRow key={t.songId} song={t.song} index={i} startRadio list={topSongs} queueContext={context} badge={`${t.plays} ${t.plays === 1 ? "play" : "plays"} · ${formatListening(t.ms)}`} />
                ))}
              </div>
            </Section>
            <Section title="Top artists" className="pt-0" action={<Button variant="link" onClick={() => navigate({ name: "history" })}>Recent history</Button>}>
              <ol className="flex flex-col">
                {stats.topArtists.slice(0, 20).map((a, i) => (
                  <li key={a.name}>
                    <button type="button" onClick={() => navigate({ name: "artist", artist: a.name })} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="w-6 text-center text-sm tabular-nums text-muted-foreground">{i + 1}</span>
                      {artistThumb.get(a.name.toLowerCase()) ? <Artwork src={artistThumb.get(a.name.toLowerCase())} size="sm" className="rounded-full" /> : <span className="flex size-art-sm items-center justify-center rounded-full bg-muted"><Mic2 className="size-4 text-muted-foreground" /></span>}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{a.name}</span>
                        <span className="block text-sm text-muted-foreground">
                          {a.plays} {a.plays === 1 ? "play" : "plays"} · {a.songCount} {a.songCount === 1 ? "song" : "songs"}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{formatListening(a.ms)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </Section>
          </div>
        </>
      ) : (
        <p className="px-8 text-muted-foreground">Loading…</p>
      )}
    </Page>
  )
}
