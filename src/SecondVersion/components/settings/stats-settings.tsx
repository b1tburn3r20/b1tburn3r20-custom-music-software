import ChangeRootDir from "@/components/Folders/ChangeRootDir"
import { Label } from "@/components/ui/label"
import { useMusicStore } from "@/stores/useMusicStore"

const StatsSettings = () => {

  const songCache = useMusicStore((f) => f.songCache)

  return (
    <div className="w-full">
      <div>
        <Label>Downloaded Songs</Label>
        <p>{songCache?.length}</p>
        <ChangeRootDir />
      </div>
    </div>
  )
}

export default StatsSettings
