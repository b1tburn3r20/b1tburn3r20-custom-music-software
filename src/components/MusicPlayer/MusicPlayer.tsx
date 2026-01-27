"use client";
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



  const handleDoubleClick = (e: any) => {
    const tag = e.target?.tagName;
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
      className={`shrink-0 flex flex-col relative transition-transform duration-1000 ease-in-out ${idle ? 'translate-y-full' : 'translate-y-0'}`}
    >
      <MusicTrack />
      <div className="grid z-[8] grid-cols-3 items-center w-full backdrop-blur-md p-4 bg-black/20 shadow-2xl inset-shadow-sm border-background/40">
        <MusicPlayerName />
        <div className="flex justify-center items-center">
          <MusicControls />
        </div>
        <div className="flex gap-2 justify-center items-center">
          <MusicVolume />
          <LoopingControls />
          <ToggleExpandPlayer />
        </div>
      </div>
    </div>
  );
};

export default MusicPlayer;
