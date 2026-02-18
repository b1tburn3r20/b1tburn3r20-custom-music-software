
import { useAppStore } from "@/stores/useAppStore"
import { useMusicStore } from "@/stores/useMusicStore"

const ArtistView = () => {
  const view = useAppStore((f) => f.view)
  const activeArtist = useMusicStore((f) => f.activeArtist)
  if (view !== "artist") {
    return null
  }

  return (
    <div>{activeArtist?.artist_name || "no artist"}</div>
  )
}

export default ArtistView
