import type { Song } from "@/types/DirectoryTypes"
import PlaylistEditPlaylistButton from "./PlaylistEditPlaylistButton"
import PlaylistShufflePlaylistButton from "./PlaylistShufflePlaylistButton"
import PlaylistStartPlaylistButton from "./PlaylistStartPlaylistButton"
import PlaylistAddSongsButton from "./PlaylistAddSongsButton"
import type { PlaylistType } from "@/types/AppTypes"

interface PlaylistActionButtonsProps {
  songs: Song[]
  playlist: PlaylistType
}

const PlaylistActionButtons = ({ songs, playlist }: PlaylistActionButtonsProps) => {
  return (
    <div className="flex gap-4 items-center">
      <PlaylistEditPlaylistButton />
      {songs?.length ? (
        <>
          <PlaylistStartPlaylistButton songs={songs} />
          <PlaylistShufflePlaylistButton />

        </>
      ) : ""}
      <PlaylistAddSongsButton playlist={playlist} />
    </div>
  )
}

export default PlaylistActionButtons
