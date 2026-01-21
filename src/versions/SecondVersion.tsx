import LaxPlayer from "@/components/LaxPlayer";
import Modals from "@/components/Modals";
import LaxPlayerNextUp from "@/components/Music/LaxPlayerNextUp";
import MusicPlayer from "@/components/MusicPlayer/MusicPlayer";
import { ScrollArea } from "@/components/ui/scroll-area";
import MusicArea from "@/SecondVersion/components/music-area";
import RecentlyPlayed from "@/SecondVersion/components/RecentlyPlayed";
import TopBar from "@/SecondVersion/components/top-bar";
import Playlists from "@/SecondVersion/Playlists";
import RenderActiveView from "@/SecondVersion/RenderActiveView";

export const SecondVersion = () => {

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden relative transition-all duration-[3000ms] ease-in-out"
    >

      <div className="flex flex-1 min-h-0 relative">
        <Playlists />
        <div className="flex flex-col w-full">
          <TopBar />
          <ScrollArea className="overflow-y-auto">
            <RenderActiveView />
          </ScrollArea>
        </div>
      </div>

      <div className="shrink-0 relative z-30">
        <MusicPlayer />
      </div>
      <LaxPlayer />
      <Modals />
      <LaxPlayerNextUp />
    </div>
  );
}
