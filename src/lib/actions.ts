// User-facing actions. Each one calls main (the single source of truth), reports
// failures with a toast, and lets the "user:changed"/"library:changed" events
// update the UI. Components must use these instead of calling IPC directly.
import { toast } from "sonner"
import { call, errorMessage } from "@/lib/api"
import type { Playlist, Settings } from "@/types/api"
import { useUserStore } from "@/stores/useUserStore"
import { getSong } from "@/stores/useLibraryStore"

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

async function attempt<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn()
  } catch (err) {
    toast.error(label, { description: errorMessage(err) })
    return undefined
  }
}

// ---------- likes ----------
export const isLiked = (songId: string) => useUserStore.getState().likedIds.has(songId)

export function setLiked(songId: string, liked: boolean) {
  return attempt(liked ? "Couldn't like song" : "Couldn't remove like", () => call(window.api.user.setLiked(songId, liked)))
}
export const toggleLike = (songId: string) => setLiked(songId, !isLiked(songId))

// ---------- recents ----------
export function recordRecentlyPlayed(songId: string) {
  // Fire-and-forget: history must never block playback.
  call(window.api.user.recordRecentlyPlayed(songId)).catch((e) => console.warn("recordRecentlyPlayed failed", e))
}
export function recordRecentPlaylist(playlistId: string) {
  call(window.api.user.recordRecentPlaylist(playlistId)).catch((e) => console.warn("recordRecentPlaylist failed", e))
}

// ---------- playlists ----------
/** Throws on validation errors so dialogs can show them inline. */
export async function createPlaylist(name: string, description = "", songIds: string[] = []): Promise<Playlist> {
  const pl = await call(window.api.user.createPlaylist({ name, description, songIds }))
  toast.success(`Created "${pl.name}"`)
  return pl
}

/** Throws on validation errors so dialogs can show them inline. */
export async function updatePlaylist(id: string, patch: { name?: string; description?: string }): Promise<Playlist> {
  return call(window.api.user.updatePlaylist(id, patch))
}

export async function deletePlaylist(id: string) {
  const pl = useUserStore.getState().playlists.find((p) => p.id === id)
  const ok = await attempt("Couldn't delete playlist", () => call(window.api.user.deletePlaylist(id)))
  if (ok) toast.info(`Deleted "${pl?.name ?? "playlist"}"`)
  return Boolean(ok)
}

export async function addSongsToPlaylist(playlistId: string, songIds: string[]) {
  const pl = useUserStore.getState().playlists.find((p) => p.id === playlistId)
  const res = await attempt("Couldn't add to playlist", () => call(window.api.user.addSongsToPlaylist(playlistId, songIds)))
  if (!res) return undefined
  const name = pl?.name ?? "playlist"
  if (res.added.length && !res.duplicates.length) toast.success(`Added ${plural(res.added.length, "song")} to "${name}"`)
  else if (res.added.length) toast.success(`Added ${plural(res.added.length, "song")} to "${name}"`, { description: `${plural(res.duplicates.length, "song was", "songs were")} already there` })
  else if (res.duplicates.length) toast.info(`Already in "${name}"`)
  if (res.invalid.length) toast.warning(`${plural(res.invalid.length, "song")} no longer in your library`)
  return res
}

export async function addSongToPlaylists(songId: string, playlistIds: string[]) {
  const res = await attempt("Couldn't add to playlist", () => call(window.api.user.addSongToPlaylists(songId, playlistIds)))
  if (!res) return undefined
  const title = getSong(songId)?.metadata.title ?? "Song"
  if (res.added.length) {
    toast.success(`Added "${title}" to ${plural(res.added.length, "playlist")}`, res.duplicates.length ? { description: `Already in ${plural(res.duplicates.length, "other playlist")}` } : undefined)
  } else if (res.duplicates.length) toast.info(`"${title}" is already in ${res.duplicates.length === 1 ? "that playlist" : "those playlists"}`)
  return res
}

export async function removeSongFromPlaylist(playlistId: string, songId: string) {
  const ok = await attempt("Couldn't remove from playlist", () => call(window.api.user.removeSongFromPlaylist(playlistId, songId)))
  return Boolean(ok)
}

// ---------- library ----------
export async function deleteSongFromLibrary(songId: string) {
  const title = getSong(songId)?.metadata.title ?? "Song"
  const res = await attempt("Couldn't delete song", () => call(window.api.library.deleteSong(songId)))
  if (res) toast.success(`Deleted "${title}"`, { description: res.how === "trash" ? "The file was moved to your trash." : undefined })
  return Boolean(res)
}

export async function selectMusicFolder() {
  const res = await attempt("Couldn't change music folder", () => call(window.api.library.selectFolder()))
  if (res) toast.success("Music folder updated", { description: `${plural(res.summary.total, "song")} found` })
  return res
}

export async function rescanLibrary() {
  const res = await attempt("Rescan failed", () => call(window.api.library.rescan()))
  if (res) toast.success("Library rescanned", { description: `${res.added} new, ${res.relinked} moved, ${res.missing} missing` })
  return res
}

// ---------- settings ----------
export function updateSettings(patch: Partial<Settings>) {
  return attempt("Couldn't save settings", () => call(window.api.user.updateSettings(patch)))
}
