"use client"
import DeletePlaylist from "./Folders/DeletePlaylist"
import DeleteSong from "./Folders/DeleteSong"

const Modals = () => {
  return (
    <div className="absolute">
      <DeletePlaylist />
      <DeleteSong />
    </div>
  )
}

export default Modals
