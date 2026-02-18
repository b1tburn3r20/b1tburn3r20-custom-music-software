import { useAppStore } from "@/stores/useAppStore"
import ActiveAlbum from "./album/components/album"

const AlbumView = () => {
  const view = useAppStore((f) => f.view)
  if (view !== "album") {
    return null
  }

  return (
    <div>
      <ActiveAlbum />
    </div>
  )
}

export default AlbumView
