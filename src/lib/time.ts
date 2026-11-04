/** "3 h 12 min", "45 min", "40 s" */
export function formatListening(ms: number): string {
  const totalMin = Math.round(ms / 60000)
  if (ms < 60000) return `${Math.round(ms / 1000)} s`
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  if (d) return `${d} d ${h} h`
  if (h) return `${h} h ${m} min`
  return `${m} min`
}

export function dayLabel(ts: number, now = Date.now()): string {
  const d = new Date(ts)
  const today = new Date(now)
  const yest = new Date(now - 86400000)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (same(d, today)) return "Today"
  if (same(d, yest)) return "Yesterday"
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" })
}
