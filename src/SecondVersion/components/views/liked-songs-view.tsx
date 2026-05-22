import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDuration } from "@/utils/textUtils";
import { Heart, Music } from "lucide-react";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { addRecentlyPlayed } from "@/components/helpers/utilities";
import { startNewQueue } from "@/utils/musicutils";
import type { Song } from "@/types/DirectoryTypes";
import { useColorCacheStore } from "@/stores/useColorCacheStore";
import PlaylistSongComponent from "../PlaylistSongComponent";
import { useMusicStore } from "@/stores/useMusicStore";
import ArtistActionButtons from "./artist/components/ArtistActionButtons";
import { useAppStore } from "@/stores/useAppStore";

const LikedSongsView = () => {
  const view = useAppStore((f) => f.view);
  const songs = useMusicStore((f) => f.likedSongs);
  const setPaused = usePlayerStore((f) => f.setPaused);
  const paused = usePlayerStore((f) => f.paused);
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying);

  const dominantColor = useColorCacheStore((state) =>
    state.getColor(
      songs[0]?.metadata.thumbnail as string | undefined,
      "Liked Songs",
    ),
  );

  const handlePlay = (song: Song) => {
    setPaused(false);
    addRecentlyPlayed(song);
    startNewQueue(song.path);
  };

  const handlePause = () => {
    setPaused(true);
  };

  const handleResume = () => {
    setPaused(false);
  };

  const NoDirSelected = () => {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <Music className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">No liked songs</p>
        <p className="text-sm">Like some music to see it here</p>
      </div>
    );
  };

  const fullDuration = songs?.reduce(
    (acc, curr) => acc + curr.metadata.duration,
    0,
  );

  if (!songs?.length) {
    return <NoDirSelected />;
  }
  if (view !== "likedSongs") return null;
  return (
    <div className="flex flex-col h-full space-y-12">
      <div
        className="relative p-8 transition-colors duration-700 "
        style={{
          background: `linear-gradient(to bottom, rgb(${dominantColor}) 0%, rgba(${dominantColor}, 0.8) 40%, rgba(${dominantColor}, 0.4) 70%, transparent 100%)`,
        }}
      >
        <div className="flex items-end gap-6">
          <div className="relative w-48 h-48 rounded-lg shadow-2xl overflow-hidden">
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: `rgba(0, 0, 0, 0.3)` }}
            >
              <Heart className="w-20 h-20 text-red-500" />
            </div>
          </div>
          <div className="flex-1 pb-2">
            <p className="text-sm font-semibold uppercase tracking-wider mb-2 text-white/90">
              Playlist
            </p>
            <h1 className="text-5xl font-bold mb-4 tracking-tight text-white">
              Your Favorites
            </h1>
            <div className="flex gap-2 items-center">
              <p className="text-sm text-white/80">
                {songs?.length || 0} songs
              </p>
              <p className="text-sm text-white/80">
                {formatDuration(fullDuration || 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-10.5">
          <ArtistActionButtons songs={songs || []} />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-8 py-4">
          {songs?.map((song, index) => (
            <PlaylistSongComponent
              key={song.metadata.title}
              index={index}
              song={song}
              onPlay={handlePlay}
              onPause={handlePause}
              onResume={handleResume}
              isPlaying={
                currentlyPlaying?.metadata.title === song.metadata.title
              }
              isPaused={paused}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default LikedSongsView;
