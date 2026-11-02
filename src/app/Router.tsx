import { useAppStore } from "@/stores/useAppStore"
import HomePage from "@/pages/HomePage"
import SearchPage from "@/pages/SearchPage"
import LibraryPage from "@/pages/LibraryPage"
import PlaylistPage from "@/pages/PlaylistPage"
import AlbumPage from "@/pages/AlbumPage"
import ArtistPage from "@/pages/ArtistPage"
import LikedPage from "@/pages/LikedPage"
import HistoryPage from "@/pages/HistoryPage"
import StatsPage from "@/pages/StatsPage"
import YoutubePage from "@/pages/YoutubePage"

export default function Router() {
  const route = useAppStore((s) => s.route)
  switch (route.name) {
    case "home":
      return <HomePage />
    case "search":
      return <SearchPage q={route.q} />
    case "library":
      return <LibraryPage tab={route.tab} />
    case "playlist":
      return <PlaylistPage key={route.id} id={route.id} />
    case "album":
      return <AlbumPage key={route.key} albumKey={route.key} />
    case "artist":
      return <ArtistPage key={route.artist} name={route.artist} />
    case "liked":
      return <LikedPage />
    case "history":
      return <HistoryPage />
    case "youtube":
      return <YoutubePage />
    case "stats":
      return <StatsPage />
  }
}
