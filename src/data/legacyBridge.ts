// TRANSITIONAL (removed in Phase 3): derives the list fields the existing
// views read from useMusicStore / useDirectoryStore / usePlayerStore /
// useSettingsStore from the new normalized stores, so the app keeps working
// while views are migrated one by one.
import { shuffled } from "@/lib/catalog"
import { resolveSongs, useLibraryStore } from "@/stores/useLibraryStore"
import { useUserStore } from "@/stores/useUserStore"
import { useMusicStore } from "@/stores/useMusicStore"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { useAppStore } from "@/stores/useAppStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import type { PlaylistType } from "@/types/AppTypes"
import type { Playlist } from "@/types/api"

function resolvePlaylist(p: Playlist, byId: ReturnType<typeof useLibraryStore.getState>["songsById"]): PlaylistType {
  return { id: p.id, name: p.name, description: p.description, created: p.created, updated: p.updated, songIds: p.songIds, songs: resolveSongs(p.songIds, byId) }
}

function recompute() {
  const lib = useLibraryStore.getState()
  const user = useUserStore.getState()
  const byId = lib.songsById
  const playlists = user.playlists.map((p) => resolvePlaylist(p, byId))
  const plById = new Map(playlists.map((p) => [p.id, p]))
  const prev = useMusicStore.getState()
  useMusicStore.setState({
    songCache: lib.songs.map((s) => ({ id: s.id, title: s.metadata.title, artist: s.metadata.artist, path: s.path, thumbnail: s.metadata.thumbnail })),
    likedSongs: resolveSongs(user.likes.map((l) => l.songId), byId),
    recentlyPlayed: resolveSongs(user.recentlyPlayed.map((r) => r.songId), byId),
    recentlyDownloaded: resolveSongs(user.recentlyDownloaded, byId),
    playlists,
    recentlyPlayedPlaylists: user.recentPlaylists.map((id) => plById.get(id)).filter((p): p is PlaylistType => Boolean(p)),
    allAlbums: lib.albums,
    randomMusic: prev.randomMusic.length && prev.randomMusic.every((s) => byId[s.id]) ? prev.randomMusic.map((s) => byId[s.id]) : shuffled(lib.songs).slice(0, 48),
  })
  // Keep the open playlist in sync instead of a stale copy.
  const app = useAppStore.getState()
  if (app.currentPlaylist) {
    const fresh = plById.get(app.currentPlaylist.id) ?? null
    app.setCurrentPlaylist(fresh)
    if (!fresh && app.view === "playlist") app.setView("home")
  }
  useDirectoryStore.getState().setRootDir(lib.rootDir)
}

function applySettings() {
  const s = useUserStore.getState().settings
  useSettingsStore.setState({ expandOnPlay: s.expandOnPlay, laxPlayerAutoHide: s.zenMode, zenModeTimeout: s.zenTimeout })
}

let installed = false
export function installLegacyBridge() {
  if (installed) return
  installed = true
  useLibraryStore.subscribe((s, p) => {
    if (s.songsById !== p.songsById || s.rootDir !== p.rootDir) recompute()
  })
  useUserStore.subscribe((s, p) => {
    if (s.playlists !== p.playlists || s.likes !== p.likes || s.recentlyPlayed !== p.recentlyPlayed || s.recentlyDownloaded !== p.recentlyDownloaded || s.recentPlaylists !== p.recentPlaylists) recompute()
    if (s.settings !== p.settings) applySettings()
  })
  recompute()
  applySettings()
}
