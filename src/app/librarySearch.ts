// What both search boxes share: the same engine and the same YouTube fallbacks.
import { useMemo } from "react"
import { ListMusic, Music, Youtube, type LucideIcon } from "lucide-react"
import { buildArtistList, searchAlbums, searchArtists, searchSongs, shuffled } from "@/lib/catalog"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { navigate } from "@/stores/useAppStore"
import { useYoutubeStore } from "@/components/youtube/searchStore"
import { useYoutubeTab } from "@/components/youtube/tabStore"
import { isLocked, useYoutubeAccess } from "@/components/youtube/accessStore"

const YTM = "https://music.youtube.com"

/** Opens in the user's browser: the main process refuses to create windows that could reach the app's API. */
function openYTMPopup(url: string) {
  if (isLocked(useYoutubeAccess.getState().access)) navigate({ name: "youtube" }) // shows how to unlock YouTube
  else window.open(url, "_blank")
}

function searchYouTubeApi(q: string, playlists: boolean) {
  const yt = useYoutubeStore.getState()
  yt.setSearchTerm(q)
  yt.setPlaylists(playlists)
  yt.incrementTriggerSearchKey()
  useYoutubeTab.getState().setTab("search")
  navigate({ name: "youtube" })
}

/** `opensPage`: it goes to a page in the app, rather than a separate window. */
export type SearchAction = { key: string; icon: LucideIcon; label: string; tag: string; opensPage: boolean; run: (q: string) => void }
export const SEARCH_ACTIONS: SearchAction[] = [
  { key: "ytm-song", icon: Music, label: "Search songs", tag: "YouTube Music", opensPage: false, run: (q) => openYTMPopup(`${YTM}/search?q=${encodeURIComponent(q)}`) },
  { key: "ytm-pl", icon: ListMusic, label: "Search playlists", tag: "YouTube Music", opensPage: false, run: (q) => openYTMPopup(`${YTM}/search?q=${encodeURIComponent(q)}&params=EgeKAQQoAUICCAE%3D`) },
  { key: "api-video", icon: Youtube, label: "Search videos", tag: "YouTube", opensPage: true, run: (q) => searchYouTubeApi(q, false) },
  { key: "api-pl", icon: ListMusic, label: "Search playlists", tag: "YouTube", opensPage: true, run: (q) => searchYouTubeApi(q, true) },
]

/** Library matches for `query`. With nothing typed, `songs` is a few random suggestions, redrawn when `suggestKey` changes. */
export function useLibrarySearch(query: string, limits: { artists: number; albums: number; songs: number }, suggestKey?: unknown) {
  const songs = useLibraryStore((s) => s.songs)
  const albums = useLibraryStore((s) => s.albums)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const suggested = useMemo(() => shuffled(songs).slice(0, limits.songs), [songs.length, limits.songs, suggestKey])
  const artistList = useMemo(() => buildArtistList(songs), [songs])
  const q = query.trim()
  return {
    q,
    artistHits: useMemo(() => (q ? searchArtists(artistList, q, limits.artists) : []), [artistList, q, limits.artists]),
    albumHits: useMemo(() => (q ? searchAlbums(albums, q, limits.albums) : []), [albums, q, limits.albums]),
    songHits: useMemo(() => (q ? searchSongs(songs, q, limits.songs) : suggested), [songs, q, limits.songs, suggested]),
  }
}
