import type { Song } from "@/types/DirectoryTypes";
import AlbumPlayButton from "./ArtistPlayButton";
import ArtistShuffleButton from "./artist-shuffle";

interface PlaylistActionButtonsProps {
  songs: Song[];
}

const ArtistActionButtons = ({ songs }: PlaylistActionButtonsProps) => {
  return (
    <div className="flex gap-4 items-center">
      {songs?.length ? (
        <>
          <AlbumPlayButton songs={songs} label={"Favorites"} />
          <ArtistShuffleButton songs={songs} />
        </>
      ) : (
        ""
      )}
    </div>
  );
};

export default ArtistActionButtons;
