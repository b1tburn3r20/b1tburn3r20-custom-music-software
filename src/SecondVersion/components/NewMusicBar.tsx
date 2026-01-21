
"use client";
import MusicPlayerTimeRunning from "@/components/MusicPlayer/components/MusicPlayerTimeRunning";
import ToggleExpandPlayer from "@/components/MusicPlayer/components/ToggleExpandPlayer";
import LoopingControls from "@/components/MusicPlayer/Controls/LoopingControls";
import MusicControls from "@/components/MusicPlayer/MusicControls";
import MusicRefsAndTitle from "@/components/MusicPlayer/MusicRefsAndTitle";
import MusicTrack from "@/components/MusicPlayer/MusicTrack";
import MusicVolume from "@/components/MusicPlayer/MusicVolume";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { Music } from "lucide-react";
const MusicPlayer = () => {
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying);

  if (!currentlyPlaying) {
    return null;
  }

  return (
    <div className="shrink-0 flex flex-col relative">
      <MusicTrack />
      <div className="grid z-[8] grid-cols-3 items-center w-full backdrop-blur-md p-4 bg-black/20 shadow-2xl inset-shadow-sm border-background/40">
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
