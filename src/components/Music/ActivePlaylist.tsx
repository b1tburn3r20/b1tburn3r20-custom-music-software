"use client"

import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { type Song } from "@/types/DirectoryTypes"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuTrigger, ContextMenuItem, ContextMenuContent } from "@/components/ui/context-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Music, Pause, Play, Search, Trash2 } from "lucide-react"
import { Input } from "../ui/input"
import { useEffect, useState } from "react"

const ActivePlaylist = () => {
  const activeDir = useDirectoryStore((f) => f.currentDir)
  const setCurrentDir = useDirectoryStore((f) => f.setCurrentDir)
  const setPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const setPlayingPlaylist = usePlayerStore((f) => f.setPlayingPlaylist)
  const playing = usePlayerStore((f) => f.currentlyPlaying)
  const paused = usePlayerStore((f) => f.paused)
  const setPaused = usePlayerStore((f) => f.setPaused)
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
    return <div className=" bg-black/50 w-full h-full flex flex-col justify-center items-center font-semibold text-muted-foreground">
      <div className="font-bold text-2xl">No playlist selected</div>
      <p>Select a folder to get started</p>
    </div>
  }

  const NoSongs = () => {
    return <div className="bg-black/50 w-full h-full flex flex-col justify-center items-center font-semibold text-muted-foreground">
      <div className="text-center mb-2 font-bold text-2xl">"{activeDir?.playlistName}" playlist empty</div>
      <p>Add songs to get started!</p>
    </div>
  }
  const handleMusicClick = () => {
    if (paused) {
      //stop
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
      // setSongToDelete(song)
      // setSongToDeleteModalOpen(true)
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
      return <img src={thumbnails[0] as string} alt="Playlist" className="w-full h-full object-cover overflow-hidden" />;
    }

    if (thumbnailCount === 2) {
      return (
        <div className="grid grid-cols-2 gap-0.5 w-full h-full overflow-hidden">
          {thumbnails.slice(0, 2).map((thumb, i) => (
            <img key={i} src={thumb as string} alt="" className="w-full h-full object-cover" />
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
          <img key={i} src={thumb as string} alt="" className="w-full h-full object-cover" />
        ))}
      </div>
    );
  };

  if (!activeDir?.playlistName) {
    return <NoDirSelected />
  }

  const shouldRender = activeDir?.songs.length
  if (activeDir?.playlistName && !shouldRender) {
    return <NoSongs />
  }
  return (
    <div className="w-full flex justify-center items-center bg-black/50">
      <div className="max-w-2xl w-full h-full flex flex-col p-6">
        <div className="flex justify-center mb-6">
          <div className="flex flex-col justify-center rounded-xl overflow-hidden items-center h-[300px] w-[300px] border-2 shrink-0">
            {renderThumbnails()}
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 ">
          <h1 className="sm:text-sm md:text-md lg:text-2xl font-bold">
            <span className="text-primary">{activeDir.playlistName}</span> Playlist
          </h1>
        </div>

        {/* Search - Fixed */}
        <div className="mb-4">
          <div className="relative w-full">
            <Search className="absolute text-muted-foreground left-2 top-1.5" />
            <Input
              className="pl-10 w-full"
              placeholder={`Search ${activeDir.playlistName}...`}
              onChange={(e) => setFilter(e.target.value)}
              value={filter}
            />
          </div>
        </div>

        {/* Songs List - Scrollable, fills remaining space */}
        <ScrollArea className="flex-1 min-h-0 ">
          <div className="flex flex-col gap-1">
            {playlistSongs?.map((song, index) => (
              <PlaylistSong key={index} song={song} />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

export default ActivePlaylist
