import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/stores/useAppStore";
import { useDirectoryStore } from "@/stores/useDirectoryStore";
import { useMusicStore } from "@/stores/useMusicStore";
import { useMemo } from "react";
import { usePlayerStore } from "@/stores/usePlayerStore";
import LowAlbumProps from "./views/artist/components/LowAlbumComponent";

const LibraryView = () => {
  const view = useAppStore((f) => f.view);
  const rootDir = useDirectoryStore((f) => f.rootDir);
  const setPaused = usePlayerStore((f) => f.setPaused);
  const paused = usePlayerStore((f) => f.paused);
  //
  const allAlbums = useMusicStore((f) => f.allAlbums);



  const handlePause = () => {
    setPaused(true);
  };

  const handleResume = () => {
    setPaused(false);
  };


  const sortedAlbums = useMemo(() => {
    return [...(allAlbums ?? [])].sort((a, b) => a.album_name.localeCompare(b.album_name));
  }, [allAlbums]);
  if (view !== "library") {
    return null;
  }

  return (
    <div>
      {allAlbums?.length ? (
        <ScrollArea className="flex-1">
          <div className="px-8 py-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6">
            {sortedAlbums?.map((album, index) => (
              <LowAlbumProps
                isPlaying={false}
                isPaused={paused}
                onPause={handlePause}
                onResume={handleResume}
                album={album}
                key={album.key}
              />
            ))}
          </div>
        </ScrollArea>
      ) : (
        <p className="p-8 text-muted-foreground">No albums in your library yet.</p>
      )}
    </div>
  );
};

export default LibraryView;
