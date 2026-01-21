import { Button } from "@/components/ui/button";
import { useDirectoryStore } from "@/stores/useDirectoryStore";
import { Folder } from "lucide-react";

const NewChangeMusicFolder = () => {
  const setRootDir = useDirectoryStore((f) => f.setRootDir);
  const setCurrentDir = useDirectoryStore((f) => f.setCurrentDir);
  const setDirData = useDirectoryStore((f) => f.setDirData);

  const handleSelectFolder = async () => {
    try {
      const result = await (window as any).electron.selectFolder();
      if (result && !result.canceled) {
        const path = result.filePaths[0];
        setCurrentDir(null);
        setRootDir(path);
        localStorage.setItem("lastRootDir", path);

        const foldersData = await (window as any).electron.readFolderTree(path);
        setDirData(foldersData);
      }
    } catch (err) {
      console.error('Error selecting folder:', err);
    }
  };

  return (
    <Button
      variant="ghost"
      className="text-muted-foreground gap-2"
      onClick={handleSelectFolder}
    >
      <Folder className="h-4 w-4" />
      Change music directory
    </Button>
  );
};

export default NewChangeMusicFolder;
