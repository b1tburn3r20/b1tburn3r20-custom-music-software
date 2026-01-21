import ViewFolders from "@/components/Folders/ViewFolders";
import LaxPlayer from "@/components/LaxPlayer";
import Modals from "@/components/Modals";
import ActivePlaylist from "@/components/Music/ActivePlaylist";
import LaxPlayerNextUp from "@/components/Music/LaxPlayerNextUp";
import MusicPlayer from "@/components/MusicPlayer/MusicPlayer";
import RightContainer from "@/components/RightSide/RightContainer";
import { usePlayerStore } from "@/stores/usePlayerStore";

export const FirstVersion = () => {
  const activeSong = usePlayerStore((f) => f.currentlyPlaying)
  const backgroundStyle = activeSong?.metadata?.thumbnail
    ? {
      backgroundImage: `url(${activeSong.metadata.thumbnail})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
    : {};
  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden relative bg-background transition-all duration-[3000ms] ease-in-out"
      style={backgroundStyle}
    >
      <div
        className={`absolute inset-0 backdrop-blur-3xl pointer-events-none z-0 transition-opacity duration-[3000ms] bg-background/40 ${activeSong?.metadata?.thumbnail ? 'opacity-100' : 'opacity-0'
          }`}
      />

      <div className="flex flex-1 min-h-0 relative z-10">
        <ViewFolders />
        {/* <DebugComponent /> */}
        <ActivePlaylist />
        <RightContainer />
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
