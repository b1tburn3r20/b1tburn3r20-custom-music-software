
import { useAppStore } from "@/stores/useAppStore"
import { useMusicStore } from "@/stores/useMusicStore"
import ActiveArtist from "./artist/components/artist"

const ArtistView = () => {
  const view = useAppStore((f) => f.view)
  const activeArtist = useMusicStore((f) => f.activeArtist)
  if (view !== "artist") {
    return null
  }

  return (
    <div> <ActiveArtist /> </ div>
  )
}

export default ArtistView
