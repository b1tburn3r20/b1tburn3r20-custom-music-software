import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu";
import { useDirectoryStore } from "@/stores/useDirectoryStore";
import { Music, Play, Shuffle, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import type { LightDirectory } from "@/types/DirectoryTypes";
import { memo, useCallback, useMemo } from "react";

interface MusicFolderProps {
  folder: LightDirectory;
  isActive: boolean;
}

const Playlist = memo(({ folder, isActive }: MusicFolderProps) => {
  console.log(`[Playlist] Rendering: ${folder.name}, songCount: ${folder.songCount}, thumbnails: ${folder.thumbnails.length}`);

  const isMany = folder?.songCount > 1 || folder?.songCount < 1;
  const setCurrentDir = useDirectoryStore((f) => f.setCurrentDir);

  const handleTriggerDeleteConfirm = useCallback(() => {
    // Handle delete
  }, []);

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

  const renderThumbnails = useMemo(() => {
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
  }, [thumbnails, thumbnailCount, isActive]);

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
              {renderThumbnails}
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
}, (prevProps, nextProps) => {
  console.log(`[Playlist Memo] Comparing ${prevProps.folder.name}:`);
  console.log('  - path:', prevProps.folder.path === nextProps.folder.path);
  console.log('  - name:', prevProps.folder.name === nextProps.folder.name);
  console.log('  - songCount:', prevProps.folder.songCount === nextProps.folder.songCount);
  console.log('  - isActive:', prevProps.isActive === nextProps.isActive);
  console.log('  - thumbnails length:', prevProps.folder.thumbnails.length === nextProps.folder.thumbnails.length);

  // Only re-render if the data actually changed
  if (prevProps.folder.path !== nextProps.folder.path) {
    console.log(`  -> RE-RENDER: path changed`);
    return false;
  }
  if (prevProps.folder.name !== nextProps.folder.name) {
    console.log(`  -> RE-RENDER: name changed`);
    return false;
  }
  if (prevProps.folder.songCount !== nextProps.folder.songCount) {
    console.log(`  -> RE-RENDER: songCount changed from ${prevProps.folder.songCount} to ${nextProps.folder.songCount}`);
    return false;
  }
  if (prevProps.isActive !== nextProps.isActive) {
    console.log(`  -> RE-RENDER: isActive changed`);
    return false;
  }

  // Deep compare thumbnails array
  if (prevProps.folder.thumbnails.length !== nextProps.folder.thumbnails.length) {
    console.log(`  -> RE-RENDER: thumbnails length changed from ${prevProps.folder.thumbnails.length} to ${nextProps.folder.thumbnails.length}`);
    return false;
  }
  for (let i = 0; i < prevProps.folder.thumbnails.length; i++) {
    if (prevProps.folder.thumbnails[i] !== nextProps.folder.thumbnails[i]) {
      console.log(`  -> RE-RENDER: thumbnail[${i}] changed`);
      return false;
    }
  }

  console.log(`  -> SKIP RE-RENDER: props are equal`);
  return true; // Props are equal, skip re-render
});

Playlist.displayName = 'Playlist';

export default Playlist;
