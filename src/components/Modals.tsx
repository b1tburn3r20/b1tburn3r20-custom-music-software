import PlaylistUpdateModal from "@/SecondVersion/playlists/PlaylistUpdateModal"
import DeletePlaylistModal from "@/SecondVersion/playlists/DeletePlaylistModal"
import DeleteSong from "./Folders/DeleteSong"

const Modals = () => {
  return (
    <>
      <DeleteSong />
      <PlaylistUpdateModal />
      <DeletePlaylistModal />
    </>
  )
}

export default Modals
