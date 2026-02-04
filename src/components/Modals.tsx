"use client"
import PlaylistUpdateModal from "@/SecondVersion/playlists/PlaylistUpdateModal"
import DeletePlaylist from "./Folders/DeletePlaylist"
import DeleteSong from "./Folders/DeleteSong"
import DeletePlaylistModal from "@/SecondVersion/playlists/DeletePlaylistModal"

const Modals = () => {
  return (
    <div className="absolute">
      <DeleteSong />
      <PlaylistUpdateModal />
      <DeletePlaylistModal />
    </div>
  )
}

export default Modals
