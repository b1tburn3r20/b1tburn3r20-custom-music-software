import { useMemo, useState } from "react"
import { formatListening } from "@/lib/time"

const DAY = 86400000
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** Minutes listened per day. Single series → one color, no legend; hover for exact values. */
export function DailyChart({ daily, days }: { daily: { day: string; ms: number }[]; days: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const bars = useMemo(() => {
    const map = new Map(daily.map((d) => [d.day, d.ms]))
    const today = new Date()
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(today.getTime() - (days - 1 - i) * DAY)
      return { day: iso(d), date: d, ms: map.get(iso(d)) ?? 0 }
    })
  }, [daily, days])
  const max = Math.max(...bars.map((b) => b.ms), 60000)
  const h = hover !== null ? bars[hover] : null
  const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { weekday: days <= 7 ? "short" : undefined, month: "short", day: "numeric" })

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="font-medium">Listening per day</span>
        <span className="tabular-nums text-muted-foreground" aria-live="polite">
          {h ? `${fmtDay(h.date)}: ${formatListening(h.ms)}` : `max ${formatListening(max)}`}
        </span>
      </figcaption>
      <div className="relative h-40" onMouseLeave={() => setHover(null)}>
        {/* recessive baseline + half line */}
        <div className="absolute inset-x-0 bottom-0 border-t border-border" aria-hidden />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border/40" aria-hidden />
        <div className="absolute inset-0 flex items-end gap-0.5" aria-hidden>
          {bars.map((b, i) => (
            // the hit target is the full column, larger than the bar
            <div key={b.day} className="flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHover(i)}>
              <div
                className={`w-full max-w-8 rounded-t-[4px] transition-colors duration-fast ${hover === i ? "bg-primary" : "bg-primary/70"}`}
                style={{ height: b.ms ? `max(2px, ${(b.ms / max) * 100}%)` : 0 }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground" aria-hidden>
        <span>{fmtDay(bars[0].date)}</span>
        <span>{fmtDay(bars[bars.length - 1].date)}</span>
      </div>
      <table className="sr-only">
        <caption>Listening time per day</caption>
        <tbody>
          {bars.map((b) => (
            <tr key={b.day}>
              <th scope="row">{fmtDay(b.date)}</th>
              <td>{formatListening(b.ms)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
