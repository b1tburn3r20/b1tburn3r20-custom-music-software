import { usePlayerStore } from "@/stores/usePlayerStore"
import { Music } from "lucide-react"
import MusicRefsAndTitle from "./MusicRefsAndTitle"
import MusicPlayerTimeRunning from "./components/MusicPlayerTimeRunning"

const MusicPlayerName = () => {
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  return (
    <div>

      <div className="flex gap-2 items-center">
        {currentlyPlaying?.metadata?.thumbnail ? (
          <div className="bg-white/10 p-1 rounded-lg shrink-0">
            <img
              className="shrink-0 w-10 h-10 object-cover rounded-lg"
              src={currentlyPlaying.metadata.thumbnail}
              alt="Album art"
            />
          </div>
        ) : (
          <div className="p-1 bg-white/10 rounded-lg flex flex-col justify-center items-center">
            <Music className="text-primary h-10 w-10 bg-secondary rounded-lg p-1" />
          </div>
        )}
        <div className="flex gap-1 flex-col">
          <MusicRefsAndTitle />
          <MusicPlayerTimeRunning />
        </div>
      </div>

    </div>
  )
}

export default MusicPlayerName
