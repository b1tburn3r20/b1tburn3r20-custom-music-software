import { useAppStore } from "@/stores/useAppStore";
import { useCallback } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Music } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import type { PlaylistType } from "@/types/AppTypes";



const UserPlaylist = ({ playlist }: { playlist: PlaylistType }) => {

  const setView = useAppStore((f) => f.setView)
  const setCurrentPlaylist = useAppStore((f) => f.setCurrentPlaylist)
  const handleClick = useCallback(() => {
    setCurrentPlaylist(playlist)
    setView("playlist")
  }, [playlist.id]);

  const playlistLength = playlist?.songs?.length || 0
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div onClick={handleClick} className="h-12 w-12 shrink-0 cursor-pointer hover:scale-105 transition-all">
              <div className="h-full w-full">
                {playlist?.songs[0]?.metadata?.thumbnail ? (
                  <div className="bg-white/10 p-1 rounded-md h-full w-full shrink-0">
                    <img
                      className="h-full w-full object-cover rounded-md"
                      src={playlist?.songs[0]?.metadata?.thumbnail}
                      alt="Album art"
                    />
                  </div>
                ) : (
                  <div className="p-1 bg-white/10 rounded-lg flex flex-col justify-center items-center">
                    <Music className="text-primary h-10 w-10 bg-secondary rounded-lg p-2" />
                  </div>
                )}
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="p-0 border-none bg-black rounded-lg">
            <ContextMenuItem className="p-2 text-xs font-semibold rounded-none">Play "{playlist?.name}"</ContextMenuItem>
            <ContextMenuItem className="p-2 text-xs font-semibold rounded-none">Update "{playlist?.name}"</ContextMenuItem>
            <ContextMenuItem className="bg-red-500/10 p-2 text-xs font-semibold rounded-none">Delete "{playlist?.name}"</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </TooltipTrigger>
      <TooltipContent side="right">
        <div className="flex flex-col gap-1">
          <span>{playlist.name}</span>
          <span className="text-muted-foreground">
            {playlistLength} {(playlistLength === 0 || playlistLength > 1) ? "songs" : "song"}
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export default UserPlaylist
