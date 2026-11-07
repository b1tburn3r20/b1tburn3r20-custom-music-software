// Whether a YouTube playlist is already here. Songs can't be compared without fetching every
// video, so a local playlist made by hand only counts as "likely": same name and same length.
type Remote = { id: string; title: string; count: number | null }
type Local = { name: string; songIds: string[]; source?: { type: string; id: string } | null }

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** A short label for a playlist that's already here, or null if it isn't (or its size isn't known yet). */
export function importLabel(remote: Remote, locals: Local[]): string | null {
  if (!remote.count) return null
  const mirror = locals.find((l) => l.source?.type === "youtube" && l.source.id === remote.id)
  if (mirror?.songIds.length) return mirror.songIds.length >= remote.count ? "Imported" : `${mirror.songIds.length} of ${remote.count} imported`
  return locals.some((l) => sameName(l.name, remote.title) && l.songIds.length === remote.count) ? "Likely installed" : null
}
