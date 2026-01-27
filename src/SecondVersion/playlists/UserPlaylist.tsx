import { useAppStore } from "@/stores/useAppStore";
import { useCallback } from "react";
import { Music } from "lucide-react";
import type { PlaylistType } from "@/types/AppTypes";
import { useColorCacheStore } from "@/stores/useColorCacheStore";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { usePlayerStore } from "@/stores/usePlayerStore";
import LottieViewer from "@/components/helpers/lottie-viewer";
const UserPlaylist = ({ playlist }: { playlist: PlaylistType }) => {
  const setView = useAppStore((f) => f.setView)
  const setCurrentPlaylist = useAppStore((f) => f.setCurrentPlaylist)
  const thumbnail = playlist?.songs?.[0]?.metadata?.thumbnail
  const playlistId = playlist?.id || playlist?.name || ""
  const playingPlaylist = usePlayerStore((f) => f.playingPlaylist)
  const dominantColor = useColorCacheStore((state) =>
    state.getColor(thumbnail as string | undefined, playlistId)
  )

  const handleClick = useCallback(() => {
    setCurrentPlaylist(playlist)
    setView("playlist")
  }, [playlist.id]);

  const playlistLength = playlist?.songs?.length || 0
  const isPlaying = playingPlaylist?.id === playlistId
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div onClick={handleClick} className="h-12 w-12 shrink-0 cursor-pointer">
          <div className="h-full w-full">
            {playlist?.songs[0]?.metadata?.thumbnail ? (
              <div className="bg-white/10 p-1 rounded-md relative h-full w-full shrink-0">
                <img
                  className="h-full w-full object-cover rounded-md"
                  src={playlist?.songs[0]?.metadata?.thumbnail}
                  alt="Album art"
                />
                {isPlaying ? (
                  <div className="absolute z-[4]  inset-0 bg-black/20 m-1 rounded-lg">
                    <LottieViewer />
                  </div>

                ) : ("")}
              </div>
            ) : (
              <div
                className="p-1 rounded-lg flex flex-col justify-center items-center h-full w-full"
                style={{ backgroundColor: `rgba(${dominantColor}, 0.2)` }}
              >
                <Music
                  className="h-10 w-10 rounded-lg p-2"
                  style={{ color: `rgb(${dominantColor})` }}
                />
              </div>
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="p-0 border-none bg-black rounded-lg">
        {playlistLength > 0 && (
          <>
            <ContextMenuItem className="p-2 text-xs font-semibold rounded-none cursor-pointer">Play "{playlist?.name}"</ContextMenuItem>

            <ContextMenuItem className="p-2 text-xs font-semibold rounded-none cursor-pointer">Update "{playlist?.name}"</ContextMenuItem>
          </>

        )}
        <ContextMenuItem className="bg-red-500/10 p-2 text-xs font-semibold rounded-b-lg rounded-t-0 cursor-pointer">Delete "{playlist?.name}"</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export default UserPlaylist
