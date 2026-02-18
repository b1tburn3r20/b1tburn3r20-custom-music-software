
import type { Song } from "@/types/DirectoryTypes"
import AlbumPlayButton from "./AlbumPlayButton"
import AlbumSuffleButton from "./AlbumShuffleButton"

interface PlaylistActionButtonsProps {
  songs: Song[]
}

const AlbumActionButtons = ({ songs }: PlaylistActionButtonsProps) => {
  return (
    <div className="flex gap-4 items-center">
      {songs?.length ? (
        <>
          <AlbumPlayButton songs={songs} />
          <AlbumSuffleButton />

        </>
      ) : ""}
    </div>
  )
}

export default AlbumActionButtons
