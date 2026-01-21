import MusicArea from "./components/music-area"
import RecentlyPlayed from "./components/RecentlyPlayed"

const SecondVersionHome = () => {
  return (
    <div>

      <div>
        <div className="mx-auto container">
          <RecentlyPlayed />
        </div>
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
