import MusicArea from "./components/music-area"
import RecentlyDownloaded from "./components/recently-downloaded"
import RecentlyPlayed from "./components/RecentlyPlayed"
import RecentlyPlayedPlaylists from "./components/RecentlyPlayedPlaylists"
import SearchResults from "./components/SearchResults"

const SecondVersionHome = () => {
  return (
    <div>
      <div className="mx-auto container">
        <SearchResults />
      </div>
      <div className="bg-black/80 py-8">
        <div className="mx-auto container">
          <RecentlyDownloaded />
        </div>
      </div>
      <div className="mx-auto container py-8">
        <RecentlyPlayed />
      </div>
      <div className="mx-auto container py-8">
        <RecentlyPlayedPlaylists />
      </div>


      <div className="bg-black/80 py-8">
        <div className="mx-auto container">
          <MusicArea />
        </div>
      </div>

    </div>
  )
}

export default SecondVersionHome
