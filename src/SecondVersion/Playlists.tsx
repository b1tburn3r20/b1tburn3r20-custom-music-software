import { ScrollArea } from "@/components/ui/scroll-area"
import { useAppStore } from "@/stores/useAppStore"
import { Home, Library } from "lucide-react"
import { useEffect } from "react"
import NewPlaylist from "./playlists/NewPlaylistButton"
import { useMusicStore } from "@/stores/useMusicStore"
import UserPlaylist from "./playlists/UserPlaylist"
import { Separator } from "@/components/ui/separator"

const Playlists = () => {
  const setView = useAppStore((f) => f.setView)
  const playlists = useMusicStore((f) => f.playlists)
  const setPlaylists = useMusicStore((f) => f.setPlaylists)
  useEffect(() => {
    const loadPlaylists = async () => {

      const result = await (window as any).electron.getPlaylists({})
      if (result.success) {
        setPlaylists(result.playlists)

        console.log("Heres the playlists", result.playlists)
      }
    }
    loadPlaylists()
  }, [])

  // const FolderPlaylist = ({ playlist }: { playlist: PlaylistType }) => {
  //   const handleClick = useCallback(() => {
  //     setView("playlist")
  //     console.log("Heres the playlist", playlist)
  //     setCurrentPlaylist(playlist)
  //   }, [playlist.id]);
  //
  //   return (
  //     <Tooltip>
  //       <TooltipTrigger asChild>
  //         <div onClick={handleClick} className="h-12 w-12 shrink-0 cursor-pointer hover:scale-105 transition-all">
  //           <div className="h-full w-full">
  //             {playlist?.songs[0]?.metadata?.thumbnail ? (
  //               <div className="bg-white/10 p-1 rounded-md h-full w-full shrink-0">
  //                 <img
  //                   className="h-full w-full object-cover rounded-md"
  //                   src={playlist?.songs[0]?.metadata?.thumbnail}
  //                   alt="Album art"
  //                 />
  //               </div>
  //             ) : (
  //               <div className="p-1 bg-white/10 rounded-lg flex flex-col justify-center items-center">
  //                 <Music className="text-primary h-10 w-10 bg-secondary rounded-lg p-1" />
  //               </div>
  //             )}
  //           </div>
  //         </div>
  //       </TooltipTrigger>
  //       <TooltipContent side="right">
  //         <div className="flex flex-col gap-1">
  //           <span>
  //             {playlist?.name}
  //           </span>
  //           <span className="text-muted-foreground">
  //             Playlist
  //           </span>
  //         </div>
  //       </TooltipContent>
  //     </Tooltip>
  //   )
  // }
  //
  const SidePanelViewModeToggle = () => {
    return (
      <div className="h-12 w-12 shrink-0 p-1 rounded-sm cursor-pointer">
        <div className="h-full w-full bg-background p-2 items-center flex-col justify-center rounded-sm">
          <Library />
        </div>
      </div>
    )
  }

  const HomeViewModeToggle = () => {
    const handleClick = () => {
      setView("home")
    }
    return (
      <div onClick={() => handleClick()} className="h-12 w-12 shrink-0 p-1 rounded-sm cursor-pointer">
        <div className="h-full w-full bg-background p-2 items-center flex-col justify-center rounded-sm">
          <Home />
        </div>
      </div>
    )
  }


  return (
    <div className="bg-muted/70 flex flex-col py-2 w-fit px-4">
      <div className="flex flex-col">
        <HomeViewModeToggle />
        <SidePanelViewModeToggle />
        <NewPlaylist />
      </div>
      <Separator className="my-4 bg-gray-500/60" />
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-2">
          {playlists?.map((playlist) => <UserPlaylist playlist={playlist} key={playlist.id} />)}
          {/* {playlistData?.map((playlist) => <FolderPlaylist playlist={playlist} key={playlist.path} />)} */}
        </div>
      </ScrollArea>
    </div>
  )
}

export default Playlists
