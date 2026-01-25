import { useAppStore } from "@/stores/useAppStore";
import { useMusicStore } from "@/stores/useMusicStore";
import { useCallback } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Music } from "lucide-react";



const UserPlaylist = ({ playlist }: { playlist: any }) => {

  const setView = useAppStore((f) => f.setView)
  const setCurrentPlaylist = useAppStore((f) => f.setCurrentPlaylist)
  const setPlaylists = useMusicStore((f) => f.setPlaylists)
  const handleClick = useCallback(() => {
    setCurrentPlaylist(playlist)
    setView("playlist")
  }, [playlist.id]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div onClick={handleClick} className="h-12 w-12 shrink-0 cursor-pointer hover:scale-105 transition-all">
          <div className="h-full w-full bg-white/10 p-1 rounded-lg">
            <div className="p-1 bg-secondary rounded-lg flex flex-col justify-center items-center h-full w-full">
              <Music className="text-muted-foreground h-6 w-6 rounded-lg " />
            </div>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        <div className="flex flex-col gap-1">
          <span>{playlist.name}</span>
          <span className="text-muted-foreground">
            {playlist.songs?.length || 0} songs
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export default UserPlaylist
