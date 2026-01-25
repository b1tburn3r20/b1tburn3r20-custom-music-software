import { useMusicStore } from "@/stores/useMusicStore"

const MusicStats = () => {
  const cache = useMusicStore((f) => f.songCache)
  return (
    <div>{cache.length}</div>
  )
}

export default MusicStats
