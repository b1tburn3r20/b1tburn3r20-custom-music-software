import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu";
import { useDirectoryStore } from "@/stores/useDirectoryStore";
import { Music, Play, Shuffle, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import type { LightDirectory } from "@/types/DirectoryTypes";
import { useCallback } from "react";

interface MusicFolderProps {
  folder: LightDirectory;
  isActive: boolean;
}

const Playlist = ({ folder, isActive }: MusicFolderProps) => {
  const setPlaylistForDelete = useDirectoryStore((f) => f.setPlaylistToDelete);
  const setPlaylistForDeleteModalOpen = useDirectoryStore((f) => f.setPlaylistToDeleteModalOpen);

  const isMany = folder?.songCount > 1 || folder?.songCount < 1;
  const setCurrentDir = useDirectoryStore((f) => f.setCurrentDir);

  const handleTriggerDeleteConfirm = useCallback(() => {
    setPlaylistForDelete(folder);
    setPlaylistForDeleteModalOpen(true);
  }, [folder, setPlaylistForDelete, setPlaylistForDeleteModalOpen]);

  const fetchPlaylistContents = useCallback(async (path: string) => {
    try {
      const playlistContents = await window.electron.readFolderDetails(path);
      setCurrentDir(playlistContents);
    } catch (err) {
      console.error('Error reading folder:', err);
    }
  }, [setCurrentDir]);

  const handleClick = useCallback(() => {
    fetchPlaylistContents(folder.path);
  }, [folder.path, fetchPlaylistContents]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      fetchPlaylistContents(folder.path);
    }
  }, [folder.path, fetchPlaylistContents]);

  const thumbnails = folder.thumbnails;
  const thumbnailCount = thumbnails.length;

  const renderThumbnails = () => {
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

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="flex items-center py-1 justify-between w-full">
          <div
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="rounded-3xl flex justify-start items-center cursor-pointer w-full"
            onClick={handleClick}
          >
            <div className="relative flex flex-col justify-center bg-background/20 overflow-hidden items-center h-10 w-24 shrink-0"
              style={{
                WebkitMaskImage: 'linear-gradient(to right, black 0%, transparent 100%)',
                maskImage: 'linear-gradient(to right, black 0%, transparent 70%)'
              }}
            >
              {renderThumbnails()}
            </div>
            <div className="ml-2">
              <p className={`text-md md:text-lg lg:text-xl font-semibold ${isActive ? "text-primary" : ""}`}>
                {folder.name}
              </p>
              <p className={`text-muted-foreground ${isActive ? "text-primary" : ""}`}>
                {folder.songCount} {isMany ? "songs" : "song"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="text-muted-foreground"><Shuffle /></Button>
            <Button variant="ghost" className="text-muted-foreground"><Play /></Button>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem className="flex text-lg items-center gap-2 h-14" onClick={handleTriggerDeleteConfirm}>
          <Trash2 className="text-red-400 scale-125" />
          <span>
            Delete <span className="font-bold text-primary">{folder?.name}</span> Playlist
          </span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

Playlist.displayName = 'Playlist';

export default Playlist;
