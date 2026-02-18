import { useAppStore } from "@/stores/useAppStore"
import SecondVersionHome from "./SecondVersionHome";
import YoutubeView from "./components/YoutubeView";
import PlaylistView from "./components/PlaylistView";
import LibraryView from "./components/LibraryView";
import ArtistView from "./components/views/ArtistView";
import AlbumView from "./components/views/AlbumView";

const RenderActiveView = () => {

  const activeSegment = useAppStore((f) => f.view)

  const renderView = () => {
    switch (activeSegment) {
      case "home":
        return <SecondVersionHome />
      case "artist":
        return <ArtistView />
      case "album":
        return <AlbumView />
      case "library":
        return <LibraryView />
      case "youtube":
        return <YoutubeView />
      case "playlist":
        return <PlaylistView />
      default:
        return <div>Unknown view</div>;
    }
  }

  return (
    <div>
      {renderView()}
    </div>
  )
}

export default RenderActiveView
