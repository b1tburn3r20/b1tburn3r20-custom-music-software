import ChangeRootDir from "@/components/Folders/ChangeRootDir"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAppStore } from "@/stores/useAppStore"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import type { LightDirectory } from "@/types/DirectoryTypes"
import { Home, Library, ListPlus, Music } from "lucide-react"
import { useCallback } from "react"

const Playlists = () => {
  const playlistData = useDirectoryStore((f) => f.dirData)
  const setCurrentDir = useDirectoryStore((f) => f.setCurrentDir)
  const setView = useAppStore((f) => f.setView)

  const fetchPlaylistContents = useCallback(async (path: string) => {
    try {
      const playlistContents = await (window as any).electron.readFolderDetails(path);
      setCurrentDir(playlistContents);
    } catch (err) {
      console.error('Error reading folder:', err);
    }
  }, [setCurrentDir]);

  const Playlist = ({ playlist }: { playlist: LightDirectory }) => {
    const handleClick = useCallback(() => {
      fetchPlaylistContents(playlist.path);
      setView("playlist")
    }, [playlist.path]);

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div onClick={handleClick} className="h-12 w-12 shrink-0 cursor-pointer hover:scale-105 transition-all">
            <div className="h-full w-full">
              {playlist?.thumbnails[0] ? (
                <div className="bg-white/10 p-1 rounded-md h-full w-full shrink-0">
                  <img
                    className="h-full w-full object-cover rounded-md"
                    src={playlist?.thumbnails[0]}
                    alt="Album art"
                  />
                </div>
              ) : (
                <div className="p-1 bg-white/10 rounded-lg flex flex-col justify-center items-center">
                  <Music className="text-primary h-10 w-10 bg-secondary rounded-lg p-1" />
                </div>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <div className="flex flex-col gap-1">
            <span>

              {playlist?.name}
            </span>
            <span className="text-muted-foreground">
              Playlist
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    )
  }
  const NewPlaylist = () => {
    return (
      <div className="h-12 w-12 shrink-0  p-1 rounded-sm cursor-pointer">
        <div className="h-full w-full bg-background p-2 items-center flex-col justify-center rounded-sm">
          <ListPlus />
        </div>
      </div>
    )
  }

  const SidePanelViewModeToggle = () => {
    return (
      <div className="h-12 w-12 shrink-0  p-1 rounded-sm cursor-pointer">
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
      <div onClick={() => handleClick()} className="h-12 w-12 shrink-0  p-1 rounded-sm cursor-pointer">
        <div className="h-full w-full bg-background p-2 items-center flex-col justify-center rounded-sm">
          <Home />
        </div>
      </div>
    )
  }


  if (!playlistData?.length) {
    return <ChangeRootDir />
  }

  return (
    <div className="bg-muted/70 flex flex-col py-2 w-fit">
      <div className="flex flex-col px-4 pb-2">
        <HomeViewModeToggle />
        <NewPlaylist />
        <SidePanelViewModeToggle />

      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-2 px-4">
          {playlistData?.map((playlist) => <Playlist playlist={playlist} key={playlist.path} />)}
        </div>
      </ScrollArea>    </div>
  )
}

export default Playlists
