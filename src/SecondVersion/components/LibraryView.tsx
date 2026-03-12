import { ScrollArea } from "@/components/ui/scroll-area"
import { useAppStore } from "@/stores/useAppStore"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { useMusicStore } from "@/stores/useMusicStore"
import { useEffect } from "react"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { addRecentlyPlayed } from "@/components/helpers/utilities"
import { startNewQueue } from "@/utils/musicutils"
import type { Song } from "@/types/DirectoryTypes"
import LowAlbumProps from "./views/artist/components/LowAlbumComponent"

const LibraryView = () => {
  const view = useAppStore((f) => f.view)
  const rootDir = useDirectoryStore((f) => f.rootDir)
  const setPaused = usePlayerStore((f) => f.setPaused)
  const setView = useAppStore((store) => store.setView)
  const paused = usePlayerStore((f) => f.paused)
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  const activeArtist = useMusicStore((f) => f.activeArtist)
  const setActiveAlbum = useMusicStore((f) => f.setActiveAlbum)
  //
  const allAlbums = useMusicStore((f) => f.allAlbums)
  const allArtists = useMusicStore((f) => f.allArtists)
  const setAllAlbums = useMusicStore((f) => f.setAllAlbums)
  const setAllArtists = useMusicStore((f) => f.setAllArtists)
  //


  const fetchArtists = async () => {
    try {
      const result: any = await (window as any).electron.getArtists({
        rootDir,
      });
      if (result.success) {
        console.log(result)
        setAllArtists(result.artists)
      } else {
      }
    } catch (err) {
      console.error("heres the error", err)
    }
  }
  const fetchAlbums = async () => {
    try {
      const result = await (window as any).electron.getAlbums({
        rootDir,

      });
      if (result.success) {
        console.log("here are the albums", result.albums)
        setAllAlbums(result.albums)
      } else {

      }
    } catch (err) {
      console.error("heres the error", err)
    }
  }
  const handlePlay = (song: Song) => {
    setPaused(false)
    addRecentlyPlayed(song)
    startNewQueue(song.path)
  }

  const handlePause = () => {
    setPaused(true)
  }

  const handleResume = () => {
    setPaused(false)
  }

  if (view !== "library") {
    return null
  }


  useEffect(() => {
    fetchArtists()
    fetchAlbums()
  }, [])



  return (
    <div>
      {allAlbums?.length ? (

        <ScrollArea className="flex-1">
          <div className="px-8 py-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6">
            {allAlbums?.map((album, index) => (
              <LowAlbumProps isPlaying={false} isPaused={paused} onPause={handlePause} onResume={handleResume} album={album} key={index} />
            ))}
          </div>
        </ScrollArea>


      ) : "no albums"}

      hi

    </div>
  )
}

export default LibraryView
