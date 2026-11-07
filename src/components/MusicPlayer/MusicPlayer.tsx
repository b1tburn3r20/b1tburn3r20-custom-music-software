import { usePlayerStore } from "@/stores/usePlayerStore"
import { useAppStore } from "@/stores/useAppStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import MusicControls from "./MusicControls"
import MusicVolume from "./MusicVolume"
import MusicTrack from "./MusicTrack"
import ToggleExpandPlayer from "./components/ToggleExpandPlayer"
import MusicPlayerName from "./MusicPlayerName"
import LikeSongButton from "./Controls/like-song-button"
import TagSongButton from "./Controls/TagSongButton"
import EqualizerButton from "./Controls/EqualizerButton"

/** The slim bar at the bottom: song · transport · volume. */
const MusicPlayer = () => {
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  const setExpanded = useSettingsStore((f) => f.setPlayerExpanded)
  const expanded = useSettingsStore((f) => f.playerExpanded)
  const idle = useAppStore((f) => f.idle)

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement)?.closest("button,input,a,[role=slider]")) setExpanded(!expanded)
  }

  if (!currentlyPlaying) return null

  return (
    <section
      aria-label="Player"
      data-region="player"
      onDoubleClick={handleDoubleClick}
      className={`relative flex shrink-0 flex-col transition-transform duration-gentle ease-standard ${idle ? "translate-y-full" : "translate-y-0"}`}
    >
      <MusicTrack />
      <div className="z-player grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-10 bg-background-dark/80 px-6 py-2 shadow-2xl backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-4">
          <MusicPlayerName />
          <div className="flex shrink-0 items-center gap-1">
            <LikeSongButton song={currentlyPlaying} />
            <TagSongButton song={currentlyPlaying} />
          </div>
        </div>
        <MusicControls />
        <div className="flex items-center justify-end gap-4">
          <EqualizerButton />
          <MusicVolume />
          <ToggleExpandPlayer />
        </div>
      </div>
    </section>
  )
}

export default MusicPlayer
