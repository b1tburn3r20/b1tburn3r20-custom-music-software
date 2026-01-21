"use client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "../ui/alert"
import { useAppStore } from "@/stores/useAppStore"
const NewPlaylist = () => {
  const [playlistName, setPlaylistName] = useState("")
  const rootDir = useDirectoryStore((f) => f.rootDir)
  const dirData = useDirectoryStore((f) => f.dirData)
  const [open, setOpen] = useState(false)
  const setDirData = useDirectoryStore((f) => f.setDirData)
  const setCurrentPlaylist = useDirectoryStore((f) => f.setCurrentDir)
  const [nameTaken, setNameTaken] = useState(false)
  const setView = useAppStore((f) => f.setView)

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
        const newfolders = await window.electron.readFolderTree(rootDir);
        console.log("new folders", newfolders)
        setDirData(newfolders);
        lookAndSetNewPlaylist(playlistName)
      }

    } catch (error) {
      console.error(error)
    } finally {
      setOpen(false)
      setPlaylistName("")
    }
  }

  const fetchPlaylistContents = async (path: string) => {
    try {
      const playlistContents = await window.electron.readFolderDetails(path);
      setCurrentPlaylist(playlistContents);
    } catch (err) {
      console.error('Error reading folder:', err);
    } finally {
      console.log("donezo")
    }
  };



  const lookAndSetNewPlaylist = (name: string) => {
    setTimeout(() => {
      const newFolder = useDirectoryStore.getState()?.dirData.find((folder) => folder.name === name)
      if (newFolder) {
        fetchPlaylistContents(newFolder.path)
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
        <Button>
          <Plus /> New
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Create a new playlist named {playlistName}
          </DialogTitle>
        </DialogHeader>
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

export default NewPlaylist
