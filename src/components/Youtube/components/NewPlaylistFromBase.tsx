
"use client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import type { TreeItem } from "@/types/DirectoryTypes"
import type { YoutubePlaylistResultType } from "@/types/YoutubeTypes"
import { ArrowRight, FolderPlus, Music } from "lucide-react"
import { useEffect, useState } from "react"

interface NewPlaylistFromBaseProps {
  onPlaylistCreate: (newFolder: TreeItem) => void
  playlist: YoutubePlaylistResultType
}

const NewPlaylistFromBase = ({ onPlaylistCreate, playlist }: NewPlaylistFromBaseProps) => {
  const [playlistName, setPlaylistName] = useState(playlist.title)
  const rootDir = useDirectoryStore((f) => f.rootDir)
  const dirData = useDirectoryStore((f) => f.dirData)
  const [open, setOpen] = useState(false)
  const setDirData = useDirectoryStore((f) => f.setDirData)
  const setCurrentDir = useDirectoryStore((f) => f.setCurrentDir)
  const [nameTaken, setNameTaken] = useState(false)


  const createPlaylist = async () => {
    const body = {
      parentPath: rootDir,
      folderName: playlistName
    }
    try {
      const response: any = await window.electron.createFolder(body)
      if (response.success === false) {
        throw new Error("Something went wrong")
      }
      if (response.success) {
        const treeData = await window.electron.readFolderTree(rootDir);
        setDirData(treeData);
        lookAndSetNewPlaylist(playlistName)
      }

    } catch (error) {
      console.error(error)
    } finally {
      setOpen(false)
      setPlaylistName("")
    }
  }

  const lookAndSetNewPlaylist = (name: string) => {
    setTimeout(() => {
      const newFolder = useDirectoryStore.getState()?.dirData.find((folder) => folder.name === name)
      if (newFolder) {
        setCurrentDir(newFolder)

        onPlaylistCreate(newFolder)
      }
    }, 200)
  }
  useEffect(() => {
    if (dirData) {
      const isTaken = dirData.some(child => child.name.toLowerCase() == playlistName.toLowerCase())
      setNameTaken(isTaken)
    }
  }, [playlistName])
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button onClick={(e) => {
          e.stopPropagation()
        }} variant={"secondary"}>
          <FolderPlus />
        </Button>
      </DialogTrigger>
      <DialogContent className="min-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {"New playlist from"}<span className="ml-2 text-primary">"{playlist.title}"</span>
          </DialogTitle>
          <DialogDescription>
            Creating a playlist named <span className="mr-1 text-primary">"{playlistName}" </span>based off the youtube playlist {playlist.title} importing {playlist.videoCount} songs to prepopulate your playlist
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
          <div className="h-fit w-fit justify-center flex gap-8 items-center">
            <div className="shrink-0 aspect-square bg-white/10 p-1  rounded-lg">
              <img className="shrink-0 w-60 h-60 object-cover rounded-lg" src={playlist.thumbnail} />
            </div>
            <div>
              <ArrowRight className="text-muted-foreground" size={80} />

            </div>
            <div className="shrink-0 aspect-square bg-white/10 p-1  rounded-lg">
              <Music className="shrink-0 text-primary p-8 w-60 h-60 object-cover rounded-lg" />
            </div>

          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            <Label>Playlist name</Label>
            <Input onKeyDown={(e) => {
              if (e.key === "Enter" && playlistName?.length) {
                createPlaylist()
              }
            }} placeholder="Music" value={playlistName} onChange={(e) => setPlaylistName(e.target.value)} />
          </div>
          {nameTaken && (
            <Alert>
              <AlertTitle>Name Taken</AlertTitle>
              <AlertDescription>The name {playlistName} is already a playlist in this music folder</AlertDescription>
            </Alert>
          )}
          <Button className="cursor-pointer" variant={"secondary"} onClick={() => createPlaylist()} disabled={!playlistName || nameTaken}>Make playlist</Button>
        </div>
      </DialogContent>

    </Dialog>
  )
}

export default NewPlaylistFromBase
