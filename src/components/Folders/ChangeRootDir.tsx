import { Button } from "@/components/ui/button";
import { useDirectoryStore } from "@/stores/useDirectoryStore";
import { findFolderByPath } from "@/utils/folderutils";
import { Folder, Smartphone, Loader2, CheckCircle2, XCircle, AlertCircle, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const ChangeRootDir = () => {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'checking' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  const setRootDir = useDirectoryStore((f) => f.setRootDir);
  const setCurrentDir = useDirectoryStore((f) => f.setCurrentDir);
  const setDirData = useDirectoryStore((f) => f.setDirData);
  const updateFolderInDirData = useDirectoryStore((f) => f.updateFolderInDirData);
  const rootDir = useDirectoryStore((f) => f.rootDir);
  const dirData = useDirectoryStore((f) => f.dirData);

  const setPath = (path: any) => {
    setRootDir(path);
    loadFolderContents(path);
    localStorage.setItem("lastRootDir", path);
  };

  const loadDataFromLocalStorage = () => {
    const lastRootDir = localStorage.getItem("lastRootDir");
    if (lastRootDir) {
      setPath(lastRootDir);
    }
  };

  const loadFolderContents = async (path: string) => {
    setLoading(true);
    try {
      const foldersData = await window.electron.readFolderTree(path);
      setDirData(foldersData);
      const latestPlaylist = useDirectoryStore.getState().currentDir;
      if (latestPlaylist?.path) {
        const restoredFolder = findFolderByPath(foldersData, latestPlaylist?.path);
        if (restoredFolder) {
          setCurrentDir(restoredFolder);
        }
      }
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const result = await window.electron.selectFolder();
      if (result && !result.canceled) {
        const path = result.filePaths[0];
        setCurrentDir(null);
        setPath(path);
      }
    } catch (err) {
      console.error('[ChangeRootDir] Error selecting folder:', err);
    }
  };

  const handleSync = async () => {
    if (!rootDir) {
      toast.error("No music folder selected", {
        description: "Please select a music folder first"
      });
      return;
    }

    setSyncing(true);
    setSyncStatus('checking');
    setSyncMessage('Checking device connection...');

    try {
      // First check if device is connected
      const connectionCheck = await window.electron.checkAdbConnection();

      if (!connectionCheck.success) {
        setSyncStatus('error');
        setSyncMessage(connectionCheck.error);

        toast.error("Connection Error", {
          description: connectionCheck.error
        });

        // Provide helpful guidance based on error type
        if (connectionCheck.needsAdb) {
          console.error('ADB not installed. Please install Android Platform Tools.');
        } else if (connectionCheck.needsDevice) {
          console.error('Connect your Pixel 8 Pro via USB.');
        } else if (connectionCheck.needsAuth) {
          console.error('Check your phone for USB debugging authorization prompt.');
        }

        setSyncing(false);
        setTimeout(() => setSyncStatus('idle'), 3000);
        return;
      }

      // Device connected, start syncing
      setSyncStatus('syncing');
      setSyncMessage('Connected! Starting sync...');

      const result = await window.electron.syncToPhone({
        rootPath: rootDir,
        folders: dirData
      });

      if (result.success) {
        setSyncStatus('success');
        setSyncMessage(result.message);

        toast.success("Sync Complete! 🎵", {
          description: `${result.synced.length} playlists synced to your Pixel 8 Pro`
        });

        console.log('Sync results:', {
          synced: result.synced,
          skipped: result.skipped,
          errors: result.errors
        });

      } else {
        setSyncStatus('error');
        setSyncMessage(result.error || 'Sync failed');

        toast.error("Sync Failed", {
          description: result.error
        });
      }

    } catch (err) {
      console.error('[ChangeRootDir] Sync error:', err);
      setSyncStatus('error');
      setSyncMessage('Unexpected error during sync');

      toast.error("Sync Error", {
        description: "An unexpected error occurred"
      });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  // Listen for sync progress updates
  useEffect(() => {
    const cleanup = window.electron.onSyncProgress?.((data) => {
      console.log('[Sync Progress]', data);
      if (data.status === 'syncing') {
        setSyncMessage(data.message);
      } else if (data.status === 'complete') {
        toast.success(data.folder, {
          description: data.message
        });
      } else if (data.status === 'error') {
        toast.error(`Error syncing ${data.folder}`, {
          description: data.message
        });
      }
    });

    return cleanup;
  }, []);

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
    loadDataFromLocalStorage();
  }, []);


  const getSyncButtonVariant = () => {
    switch (syncStatus) {
      case 'success':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return 'ghost';
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        className='text-muted-foreground md:text-xs cursor-pointer text-md'
        onClick={handleSelectFolder}
        variant="ghost"
        disabled={loading}
      >
        <Folder /> {loading ? 'Loading...' : 'Change Folder'}
      </Button>

      <Button
        className='text-muted-foreground md:text-xs cursor-pointer text-md'
        onClick={handleSync}
        variant={getSyncButtonVariant()}
        disabled={syncing || loading || !rootDir}
        title={syncMessage || 'Sync to Pixel 8 Pro'}
      >
        <RefreshCcw className={`${syncing ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
};

export default ChangeRootDir;
