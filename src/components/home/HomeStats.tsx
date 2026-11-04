import { useMemo } from "react"
import { formatListening } from "@/lib/time"
import { daysListened, lastDays, weekChange } from "@/lib/homeFeed"
import { navigate } from "@/stores/useAppStore"
import { openArtist } from "@/utils/musicutils"
import type { StatsSummary } from "@/types/api"

function Tile({ label, value, hint, onClick, children }: { label: string; value: string; hint?: string; onClick: () => void; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex min-w-0 items-end justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <span className="truncate text-lg font-bold tabular-nums" title={value}>
          {value}
        </span>
        {hint && (
          <span className="truncate text-xs text-muted-foreground" title={hint}>
            {hint}
          </span>
        )}
      </span>
      {children}
    </button>
  )
}

/** Seven small bars of listening; the numbers are in the tile, and each bar has a tooltip. */
function WeekBars({ daily }: { daily: StatsSummary["daily"] }) {
  const days = useMemo(() => lastDays(daily, 7), [daily])
  const max = Math.max(...days.map((d) => d.ms), 60_000)
  return (
    <span className="hidden h-10 shrink-0 items-end gap-0.5 @2xl:flex" aria-hidden>
      {days.map((d) => (
        <span key={d.day} className="flex h-full w-1.5 items-end" title={`${d.date.toLocaleDateString(undefined, { weekday: "short" })}: ${formatListening(d.ms)}`}>
          <span className="w-full rounded-t-[2px] bg-primary/70" style={{ height: d.ms ? `max(2px, ${(d.ms / max) * 100}%)` : 0 }} />
        </span>
      ))}
    </span>
  )
}

/** A few fun numbers; each opens where you can dig further. Hidden until there is any listening. */
export function HomeStats({ week, all }: { week?: StatsSummary; all?: StatsSummary }) {
  const listened = useMemo(() => daysListened(all?.daily ?? []), [all])
  const change = useMemo(() => weekChange(all?.daily ?? []), [all])
  if (!week || !all || all.totalMs === 0) return null
  const artist = week.topArtists.find((a) => a.name !== "Unknown artist")
  const openStats = () => navigate({ name: "stats" })
  const since = listened.since?.toLocaleDateString(undefined, { month: "short", day: "numeric", year: listened.since.getFullYear() === new Date().getFullYear() ? undefined : "numeric" })
  return (
    <div className="grid grid-cols-3 gap-2">
      <Tile label="This week" value={formatListening(week.totalMs)} hint={change ?? `${week.plays} plays`} onClick={openStats}>
        <WeekBars daily={all.daily} />
      </Tile>
      <Tile label="Days listened" value={String(listened.days)} hint={since && `since ${since}`} onClick={openStats} />
      <Tile
        label="On repeat"
        value={artist?.name ?? "Nobody yet"}
        hint={artist ? `${artist.plays} ${artist.plays === 1 ? "play" : "plays"} this week` : "nothing played this week"}
        onClick={() => (artist ? openArtist(artist.name) : openStats())}
      />
    </div>
  )
}
