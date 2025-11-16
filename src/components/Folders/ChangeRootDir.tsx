import { Button } from "@/components/ui/button";
import { useDirectoryStore } from "@/stores/useDirectoryStore";
import { findFolderByPath } from "@/utils/folderutils";
import { Folder } from "lucide-react";
import { useEffect, useState } from "react";

const ChangeRootDir = () => {
  const [loading, setLoading] = useState(false)
  const setRootDir = useDirectoryStore((f) => f.setRootDir)
  const setCurrentDir = useDirectoryStore((f) => f.setCurrentDir)
  const setDirData = useDirectoryStore((f) => f.setDirData)
  const updateFolderInDirData = useDirectoryStore((f) => f.updateFolderInDirData)
  const rootDir = useDirectoryStore((f) => f.rootDir)

  const setPath = (path: any) => {
    setRootDir(path)
    loadFolderContents(path)
    localStorage.setItem("lastRootDir", path)
  }

  const loadDataFromLocalStorage = () => {
    const lastRootDir = localStorage.getItem("lastRootDir")
    if (lastRootDir) {
      console.log("[ChangeRootDir] LAST ROOT DIR", lastRootDir)
      setPath(lastRootDir)
    }
  }

  const loadFolderContents = async (path: string) => {
    setLoading(true);
    try {
      const foldersData = await window.electron.readFolderTree(path);
      console.log("[ChangeRootDir] Setting dir data", foldersData)
      setDirData(foldersData);
      const latestPlaylist = useDirectoryStore.getState().currentDir
      console.log("[ChangeRootDir] This is the latest playlist", latestPlaylist)
      if (latestPlaylist?.path) {
        const restoredFolder = findFolderByPath(foldersData, latestPlaylist?.path)
        if (restoredFolder) {
          console.log("[ChangeRootDir] Heres the restored folder", restoredFolder)
          setCurrentDir(restoredFolder)
        }
      }
    } catch (err) {
      console.error('[ChangeRootDir] Error reading folder:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const result = await window.electron.selectFolder();
      if (result && !result.canceled) {
        const path = result.filePaths[0];
        setCurrentDir(null)
        setPath(path)
      }
    } catch (err) {
      console.error('[ChangeRootDir] Error selecting folder:', err);
    }
  };

  useEffect(() => {
    console.log('[ChangeRootDir] Setting up download-complete listener');
    const cleanup = window.electron.onDownloadComplete((data) => {
      console.log('[ChangeRootDir] Download complete received:', data);
      console.log('  - folderPath:', data.folderPath);
      console.log('  - updatedFolder:', data.updatedFolder);

      if (!data.updatedFolder) {
        console.warn('[ChangeRootDir] No updatedFolder data received!');
        return;
      }

      updateFolderInDirData(data.folderPath, data.updatedFolder);
      console.log('[ChangeRootDir] Called updateFolderInDirData');
    });
    return cleanup;
  }, [updateFolderInDirData]);

  useEffect(() => {
    loadDataFromLocalStorage()
  }, [])

  return (
    <div>
      <Button
        className='text-muted-foreground md:text-xs cursor-pointer text-md'
        onClick={handleSelectFolder}
        variant="ghost"
        disabled={loading}
      >
        <Folder /> {loading ? 'Loading...' : 'Change Music Folder'}
      </Button>
    </div>
  )
}

export default ChangeRootDir
