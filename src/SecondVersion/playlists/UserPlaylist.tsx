import { useAppStore } from "@/stores/useAppStore";
import { useCallback, useState } from "react";
import { Music, Play, Shuffle, Pencil, Trash2 } from "lucide-react";
import type { PlaylistType } from "@/types/AppTypes";
import { useColorCacheStore } from "@/stores/useColorCacheStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import LottieViewer from "@/components/helpers/lottie-viewer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMusicStore } from "@/stores/useMusicStore";
import { addRecentlyPlayed, shuffleArray } from "@/components/helpers/utilities";
import { startNewQueueFromArray } from "@/utils/musicutils";

const UserPlaylist = ({ playlist }: { playlist: PlaylistType }) => {
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  const setPlaylistForDelete = useAppStore((f) => f.setPlaylistForDelete)
  const setView = useAppStore((f) => f.setView);
  const setCurrentPlaylist = useAppStore((f) => f.setCurrentPlaylist);
  const thumbnail = playlist?.songs?.[0]?.metadata?.thumbnail;
  const playlistId = playlist?.id || playlist?.name || "";
  const playingPlaylist = usePlayerStore((f) => f.playingPlaylist);

  const dominantColor = useColorCacheStore((state) =>
    state.getColor(thumbnail as string | undefined, playlistId)
  );

  const setQueue = useMusicStore((f) => f.setQueue);
  const startPlaying = usePlayerStore((f) => f.setCurrentlyPlaying);
  const setPlayingPlaylist = usePlayerStore((f) => f.setPlayingPlaylist);

  const handleClick = useCallback(() => {
    setCurrentPlaylist(playlist);
    setView("playlist");
  }, [playlist.id, setCurrentPlaylist, setView]);

  const handlePlayPlaylist = useCallback(() => {
    setPlayingPlaylist(playlist);
    setQueue(playlist?.songs);
    startPlaying(playlist?.songs[0]);
    addRecentlyPlayed(playlist?.songs[0]);
    setContextMenuOpen(false);
  }, [playlist, setPlayingPlaylist, setQueue, startPlaying]);

  const handleShufflePlaylist = useCallback(() => {
    const shuffled = shuffleArray(playlist?.songs)
    startNewQueueFromArray(shuffled, playlist)
    setContextMenuOpen(false);
    setPlayingPlaylist(playlist);
  }, [playlist, setPlayingPlaylist, setQueue, startPlaying]);

  const handleRenamePlaylist = useCallback(() => {
    setContextMenuOpen(false);
  }, [playlist]);

  const handleDeletePlaylist = useCallback(() => {
    setPlaylistForDelete(playlist)
    setContextMenuOpen(false);
  }, [playlist]);

  const playlistLength = playlist?.songs?.length || 0;
  const isPlaying = playingPlaylist?.id === playlistId;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
        <TooltipTrigger asChild>
          <div
            onClick={handleClick}
            className="h-12 w-12 shrink-0 cursor-pointer group"
          >
            <div className="h-full w-full transition-transform group-hover:scale-105">
              {playlist?.songs[0]?.metadata?.thumbnail ? (
                <div className="bg-white/10 p-1 rounded-md relative h-full w-full shrink-0 transition-all group-hover:bg-white/20">
                  <img
                    className="h-full w-full object-cover rounded-md"
                    src={playlist?.songs[0]?.metadata?.thumbnail}
                    alt={`${playlist.name} playlist cover`}
                  />
                  {isPlaying ? (
                    <div className="absolute z-[4] inset-0 bg-black/20 m-1 rounded-lg">
                      <LottieViewer />
                    </div>
                  ) : (
                    <div className="absolute z-[4] inset-0 bg-black/40 m-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="h-5 w-5 text-white fill-white" />
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="p-1 rounded-lg flex flex-col justify-center items-center h-full w-full transition-all group-hover:brightness-110"
                  style={{ backgroundColor: `rgba(${dominantColor}, 0.2)` }}
                >
                  <Music
                    className="h-10 w-10 rounded-lg p-2 transition-transform group-hover:scale-110"
                    style={{ color: `rgb(${dominantColor})` }}
                  />
                </div>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          hideArrow
          align="start"
          className="p-0 border border-white/10 bg-zinc-900/95 backdrop-blur-xl rounded-lg w-64 shadow-2xl overflow-hidden  "
          sideOffset={8}

        >
          <div className="flex flex-col ">
            <div className="px-3 py-2 border-b border-white/5 bg-white/5">
              <p className="text-xs font-semibold text-white/90 truncate">
                {playlist?.name}
              </p>
              <p className="text-[10px] text-white/50 mt-0.5">
                {playlistLength} {playlistLength === 1 ? 'song' : 'songs'}
              </p>
            </div>

            {playlistLength > 0 && (
              <div className="p-1 pb-0">
                <button
                  onClick={handlePlayPlaylist}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded-md transition-colors group  "
                >
                  <Play className="h-4 w-4 text-white/60 group-hover:text-white transition-colors" />
                  <span className="font-medium">Play</span>
                </button>

                <button
                  onClick={handleShufflePlaylist}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded-md transition-colors group"
                >
                  <Shuffle className="h-4 w-4 text-white/60 group-hover:text-white transition-colors" />
                  <span className="font-medium">Shuffle</span>
                </button>

                <div className="h-px mb-0 pb-0 bg-white/5 my-1" />
              </div>
            )}

            <div className="p-1">
              <button
                onClick={handleRenamePlaylist}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded-md transition-colors group"
              >
                <Pencil className="h-4 w-4 text-white/60 group-hover:text-white transition-colors" />
                <span className="font-medium">Rename</span>
              </button>

              <div className="h-px bg-white/5 my-1" />

              <button
                onClick={handleDeletePlaylist}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-md transition-colors group"
              >
                <Trash2 className="h-4 w-4 text-red-400/80 group-hover:text-red-400 transition-colors" />
                <span className="font-medium">Delete playlist</span>
              </button>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default UserPlaylist;
