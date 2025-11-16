"use client";
import { usePlayerStore } from "@/stores/usePlayerStore";
import MusicControls from "./MusicControls";
import MusicVolume from "./MusicVolume";
import MusicTrack from "./MusicTrack";
import { Music } from "lucide-react";
import LoopingControls from "./Controls/LoopingControls";
import MusicRefsAndTitle from "./MusicRefsAndTitle";

const MusicPlayer = () => {
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying);

  if (!currentlyPlaying) {
    return null;
  }

  return (
    <div className="shrink-0 flex flex-col z-[30] relative">
      <MusicTrack />
      <div className="grid z-[8] grid-cols-3 items-center w-full backdrop-blur-md p-4 bg-primary/5 shadow-2xl inset-shadow-sm border-background/40">
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
          <MusicRefsAndTitle />
        </div>
        <div className="flex justify-center items-center">
          <MusicControls />
        </div>
        <div className="flex gap-2 justify-center items-center">
          <MusicVolume />
          <LoopingControls />
        </div>
      </div>
    </div>
  );
};

export default MusicPlayer;
