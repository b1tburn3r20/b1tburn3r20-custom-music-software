import { ScrollArea } from "@/components/ui/scroll-area"
import { useAppStore } from "@/stores/useAppStore"
import { Home, Library, Youtube } from "lucide-react"
import { useEffect } from "react"
import NewPlaylist from "./playlists/NewPlaylistButton"
import { useMusicStore } from "@/stores/useMusicStore"
import UserPlaylist from "./playlists/UserPlaylist"
import { Separator } from "@/components/ui/separator"
import { useColorCacheStore } from "@/stores/useColorCacheStore"
import SmallRandomQueueButton from "./components/SmallRandomQueueButton"
import SmallRandomPlaylistButton from "./components/SmallRandomPlaylistButton"

const LeftBar = () => {
  const setView = useAppStore((f) => f.setView)
  const playlists = useMusicStore((f) => f.playlists)
  const setPlaylists = useMusicStore((f) => f.setPlaylists)

  useEffect(() => {
    const loadPlaylists = async () => {
      const result = await (window as any).electron.getPlaylists({})
      if (result.success) {
        setPlaylists(result.playlists)
      }
    }
    loadPlaylists()
  }, [])

  const SidePanelViewModeToggle = () => {
    const dominantColor = useColorCacheStore((state) =>
      state.getColor(undefined, "library-view-btn")
    )

    return (
      <div onClick={() => setView("library")} className="h-12 w-12 shrink-0 cursor-pointer">
        <div className="h-full w-full">
          <div
            className="p-1 rounded-lg flex flex-col justify-center items-center h-full w-full"
            style={{ backgroundColor: `rgba(${dominantColor}, 0.2)` }}
          >
            <Library
              className="h-10 w-10 rounded-lg p-2"
              style={{ color: `rgb(${dominantColor})` }}
            />
          </div>
        </div>
      </div>
    )
  }
  const YouTubeViewButton = () => {
    const dominantColor = useColorCacheStore((state) =>
      state.getColor(undefined, "youtube-view")
    )

    return (
      <div onClick={() => setView("youtube")} className="h-12 w-12 shrink-0 cursor-pointer">
        <div className="h-full w-full">
          <div
            className="p-1 rounded-lg flex flex-col justify-center items-center h-full w-full"
            style={{ backgroundColor: `rgba(${dominantColor}, 0.2)` }}
          >
            <Youtube
              className="h-10 w-10 rounded-lg p-2"
              style={{ color: `rgb(${dominantColor})` }}
            />
          </div>
        </div>
      </div>
    )
  }


  const HomeViewModeToggle = () => {
    const dominantColor = useColorCacheStore((state) =>
      state.getColor(undefined, "home-view")
    )

    const handleClick = () => {
      setView("home")
    }

    return (
      <div onClick={handleClick} className="h-12 w-12 shrink-0 cursor-pointer">
        <div className="h-full w-full">
          <div
            className="p-1 rounded-lg flex flex-col justify-center items-center h-full w-full"
            style={{ backgroundColor: `rgba(${dominantColor}, 0.2)` }}
          >
            <Home
              className="h-10 w-10 rounded-lg p-2"
              style={{ color: `rgb(${dominantColor})` }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-unset  flex flex-col py-4 border-r border-muted/30 w-fit px-4">

      <div className="flex flex-col gap-2">
        <HomeViewModeToggle />
        <SidePanelViewModeToggle />
        <YouTubeViewButton />
      </div>
      <Separator className="my-4 bg-gray-500/60" />

      <div className="flex flex-col gap-2">
        <div className="cursor-pointer aspect-square">
          <SmallRandomQueueButton />
        </div>
        <div className="cursor-pointer aspect-square">
          <SmallRandomPlaylistButton />
        </div>

      </div>
      <Separator className="my-4 bg-gray-500/60" />
      <div className="mb-2">
        <NewPlaylist />
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-2">
          {playlists?.map((playlist) => <UserPlaylist playlist={playlist} key={`${playlist.id}-${playlist?.songs?.length}`} />)}
        </div>
      </ScrollArea>
    </div>
  )
}

export default LeftBar
