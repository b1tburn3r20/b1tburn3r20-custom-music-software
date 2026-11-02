import { usePlayerStore } from "@/stores/usePlayerStore";
import MusicControls from "./MusicControls";
import MusicVolume from "./MusicVolume";
import MusicTrack from "./MusicTrack";
import LoopingControls from "./Controls/LoopingControls";
import ToggleExpandPlayer from "./components/ToggleExpandPlayer";
import { useAppStore } from "@/stores/useAppStore";
import MusicPlayerName from "./MusicPlayerName";
import { useSettingsStore } from "@/stores/useSettingsStore";

const MusicPlayer = () => {
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying);
  const setExpanded = useSettingsStore((f) => f.setPlayerExpanded)
  const expanded = useSettingsStore((f) => f.playerExpanded)
  const idle = useAppStore((f) => f.idle)



  const handleDoubleClick = (e: React.MouseEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (!["SPAN", "BUTTON", "INPUT"].includes(tag)) {
      setExpanded(!expanded)
    }
  }

  if (!currentlyPlaying) {
    return null;
  }

  return (
    <div
      onDoubleClick={(e) => handleDoubleClick(e)}
      className={`relative flex shrink-0 flex-col transition-transform duration-gentle ease-standard ${idle ? 'translate-y-full' : 'translate-y-0'}`}
    >
      <MusicTrack />
      <div className="z-player grid w-full grid-cols-3 items-center gap-4 bg-background/70 p-4 shadow-2xl backdrop-blur-md">
        <MusicPlayerName />
        <div className="flex justify-center items-center">
          <MusicControls />
        </div>
        <div className="flex items-center justify-end gap-2">
          <MusicVolume />
          <LoopingControls />
          <ToggleExpandPlayer />
        </div>
      </div>
    </div>
  );
};

export default MusicPlayer;
