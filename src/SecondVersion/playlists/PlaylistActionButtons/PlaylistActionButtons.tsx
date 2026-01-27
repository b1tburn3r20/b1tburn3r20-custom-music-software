import type { Song } from "@/types/DirectoryTypes"
import PlaylistEditPlaylistButton from "./PlaylistEditPlaylistButton"
import PlaylistShufflePlaylistButton from "./PlaylistShufflePlaylistButton"
import PlaylistStartPlaylistButton from "./PlaylistStartPlaylistButton"
import PlaylistAddSongsButton from "./PlaylistAddSongsButton"

interface PlaylistActionButtonsProps {
  songs: Song[]
}

const PlaylistActionButtons = ({ songs }: PlaylistActionButtonsProps) => {
  return (
    <div className="flex gap-4 items-center">
      <PlaylistEditPlaylistButton />
      {songs?.length ? (
        <>
          <PlaylistStartPlaylistButton songs={songs} />
          <PlaylistShufflePlaylistButton />

        </>
      ) : ""}
      <PlaylistAddSongsButton />
    </div>
  )
}

export default PlaylistActionButtons
