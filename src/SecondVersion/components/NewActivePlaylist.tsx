"use client"

import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { usePlayerStore, type MP3Metadata } from "@/stores/usePlayerStore"
import { type Song } from "@/types/DirectoryTypes"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuTrigger, ContextMenuItem, ContextMenuContent } from "@/components/ui/context-menu"
import { Dot, Edit, Music, Pause, Play, Search, Shuffle, Slash, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { fancyTimeFormat } from "@/components/helpers/stringfuncs"
import { Separator } from "@/components/ui/separator"

const NewActivePlaylist = () => {
  const activeDir = useDirectoryStore((f) => f.currentDir)
  const setCurrentDir = useDirectoryStore((f) => f.setCurrentDir)
  const setPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const setPlayingPlaylist = usePlayerStore((f) => f.setPlayingPlaylist)
  const playing = usePlayerStore((f) => f.currentlyPlaying)
  const paused = usePlayerStore((f) => f.paused)
  const setPaused = usePlayerStore((f) => f.setPaused)
  const setSongToDelete = useDirectoryStore((f) => f.setSongToDelete)
  const setSongToDeleteModalOpen = useDirectoryStore((f) => f.setSongToDeleteModalOpen)
  const [playlistSongs, setPlaylistSongs] = useState(activeDir?.songs)
  const [filter, setFilter] = useState("")

  const filterSongs = () => {
    if (!filter) {
      setPlaylistSongs(activeDir?.songs)
    } else {
      const filtered = activeDir?.songs?.filter((playlist) => playlist.name.toLowerCase().includes(filter.toLowerCase()))
      setPlaylistSongs(filtered)
    }
  }

  useEffect(() => {
    filterSongs()
  }, [filter, activeDir])

  useEffect(() => {
    const cleanup = window.electron.onDownloadComplete(async (data) => {
      console.log("this the data", data)
      if (activeDir?.path === data.folderPath) {
        const updatedDir = await window.electron.readFolderDetails(data.folderPath);
        setCurrentDir(updatedDir);
      }
    });
    return cleanup;
  }, [activeDir?.path]);


  const NoDirSelected = () => {
    return <div className="bg-black/50 w-full min-h-[calc(100vh-8rem)] flex flex-col justify-center items-center font-semibold text-muted-foreground">
      <div className="font-bold text-2xl">No playlist selected</div>
      <p>Select a folder to get started</p>
    </div>
  }

  const NoSongs = () => {
    return <div className="bg-black/50 w-full min-h-[calc(100vh-8rem)] flex flex-col justify-center items-center font-semibold text-muted-foreground">
      <div className="text-center mb-2 font-bold text-2xl">"{activeDir?.playlistName}" playlist empty</div>
      <p>Add songs to get started!</p>
    </div>
  }
  const handleMusicClick = () => {
    if (paused) {
      setPaused(false)
    } else {
      setPaused(true)
    }
  }
  const PlaylistSong = ({ song }: { song: Song }) => {
    const isPlaying = playing?.name === song.name
    const playSong = () => {
      setPlayingPlaylist(activeDir)
      if (isPlaying && !paused) {
        setPaused(true)
      } else {
        setPlaying(song)
        setPaused(false)

      }
    }

    const handleTriggerDeleteConfirm = () => {
      setSongToDelete(song)
      setSongToDeleteModalOpen(true)
    }


    const PlayButton = () => {
      return (
        <>
          {
            isPlaying ? (
              <div>
                <Button onClick={() => handleMusicClick()}>
                  {paused ? <Play /> : <Pause />}
                </Button>
              </div >
            ) : (
              <div>
                <Button onClick={() => setPlaying(song)}><Play /> </Button>
              </div>
            )}

        </>
      )
    }

    return <ContextMenu>
      <ContextMenuTrigger asChild>

        <div onClick={() => playSong()} className="rounded-3xl mt-2 bg-secondary/40 p-1">


          <div className="flex gap-4 min-w-md items-center p-2">
            <div className="shrink-0">

              {song?.metadata?.thumbnail ? (
                <div className="shrink-0 aspect-square bg-white/10 p-1  rounded-lg">

                  <img className="shrink-0 w-10 h-10 object-cover rounded-lg" src={song.metadata.thumbnail} />

                </div>
              ) : (
                <div className="p-1 bg-white/10 rounded-lg flex flex-col justify-center items-center">

                  <Music className="text-primary h-10 w-10 bg-secondary rounded-lg p-1" />

                </div>
              )}

            </div>
            <div className="flex gap-1 justify-between w-full items-center">
              <p className={`line-clamp-2 ${isPlaying && "text-primary"}`}>
                {song?.metadata?.title}
              </p>
              <div className="flex gap-2 items-center">

                <p className="text-muted-foreground">
                  {song.metadata?.durationFormatted}
                </p>

                <PlayButton />
              </div>

            </div>
          </div>
        </div>

      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem className="flex items-center gap-2 h-10" onClick={() => handleTriggerDeleteConfirm()}>
          <Trash2 className="text-red-400" />
          <span> Remove{" "}<span className="font-bold text-primary">{song?.metadata?.title} from playlist {activeDir?.playlistName}</span>
          </span>
        </ContextMenuItem>


      </ContextMenuContent>
    </ContextMenu >

  }
  const isActive = true
  const renderThumbnails = () => {
    if (!activeDir) {
      return
    }
    const thumbnails = activeDir.thumbnails;
    const thumbnailCount = thumbnails.length;


    if (!activeDir?.thumbnails) {
      return
    }
    if (thumbnailCount === 0) {
      return <Music className={`${isActive ? "text-primary" : "text-primary/50"} h-full w-full p-3`} />;
    }

    if (thumbnailCount === 1) {
      return <img src={thumbnails[0] as string} alt="Playlist" className="w-full h-full object-cover overflow-hidden select-none" />;
    }

    if (thumbnailCount === 2) {
      const displayThumbs = [thumbnails[0], thumbnails[1], thumbnails[0], thumbnails[1]];
      return (
        <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full overflow-hidden">
          {displayThumbs.map((thumb, i) => (
            <img key={i} src={thumb as string} alt="" className="w-full h-full object-cover select-none" />
          ))}
        </div>
      );
    }

    const displayThumbs = thumbnailCount === 3
      ? [thumbnails[0], thumbnails[1], thumbnails[1], thumbnails[2]]
      : thumbnails.slice(0, 4);

    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full overflow-hidden">
        {displayThumbs.map((thumb, i) => (
          <img key={i} src={thumb as string} alt="" className="w-full h-full object-cover select-none" />
        ))}
      </div>
    );
  };

  const AlbumInformation = () => {
    if (!activeDir?.songs.length) {
      return null
    }
    const totalLength = activeDir.songs.reduce(
      (acc: number, song: any) => acc + song.metadata.duration,
      0
    );
    return (
      <div className=" inset-0 flex items-center justify-start">
        <div className="relative z-10 text-center px-8 py-6 w-full ">
          <div className="flex gap-4 justify-start w-full">
            <h1 className="text-6xl font-bold text-white drop-shadow-lg mb-2">
              {activeDir.playlistName}
            </h1>
            <div className="flex flex-col items-start justify-center">

              <p className="text-lg text-muted-foreground">Playlist</p>
              <div className="flex text-muted-foreground text-sm gap-2">
                <span>{activeDir.songs.length} songs</span>
                <Dot />
                <span>

                  {fancyTimeFormat(totalLength)}
                </span>


              </div>
            </div>

          </div>
          <p className="text-white/80 text-base font-medium">
          </p>
          <div className="flex justify-start items-center mt-2 gap-4">
            <Button variant={"secondary"}>
              <Edit />
            </Button>
            <Button>
              <Play />
            </Button>
            <Button>
              <Shuffle />
            </Button>



          </div>

        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60 pointer-events-none" />
      </div>)
  }



  if (!activeDir?.playlistName) {
    return <NoDirSelected />
  }

  const shouldRender = activeDir?.songs.length
  if (activeDir?.playlistName && !shouldRender) {
    return <NoSongs />
  }
  return (


    <div className="w-full bg-black/50">
      <div className="container mx-auto">
        <div className="flex gap-6 py-4">
          <div className="relative w-fit shrink-0">
            <div
              className="select-none relative flex flex-col justify-center bg-background/20 overflow-hidden items-center h-full w-[800px] aspect-square shrink-0"
              style={{
                WebkitMaskImage:
                  'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.3) 10%, rgba(0,0,0,0.7) 20%, black 30%, black 70%, rgba(0,0,0,0.7) 80%, rgba(0,0,0,0.3) 90%, transparent 100%)',
                maskImage:
                  'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.3) 10%, rgba(0,0,0,0.7) 20%, black 30%, black 70%, rgba(0,0,0,0.7) 80%, rgba(0,0,0,0.3) 90%, transparent 100%)',
              }}
            >
              {renderThumbnails()}
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60 pointer-events-none" />
            </div>

            <div className="absolute top-0 bg-black/50 w-full" />
          </div>

          <div className="w-full h-[80vh] flex flex-col">
            <div className="shrink-0">
              <AlbumInformation />
            </div>
            <ScrollArea className="flex-1 overflow-y-auto">
              <div>
                {playlistSongs?.map((song, index) => (
                  <PlaylistSong key={index} song={song} />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NewActivePlaylist
