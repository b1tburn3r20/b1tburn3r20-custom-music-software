"use client"
import PlaylistUpdateModal from "@/SecondVersion/playlists/PlaylistUpdateModal"
import DeletePlaylist from "./Folders/DeletePlaylist"
import DeleteSong from "./Folders/DeleteSong"

const Modals = () => {
  return (
    <div className="absolute">
      <DeletePlaylist />
      <DeleteSong />
      <PlaylistUpdateModal />
    </div>
  )
}

export default Modals
