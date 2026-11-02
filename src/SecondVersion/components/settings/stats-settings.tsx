import ChangeRootDir from "@/components/Folders/ChangeRootDir"
import { Label } from "@/components/ui/label"
import { useLibraryStore } from "@/stores/useLibraryStore"

const StatsSettings = () => {
  const count = useLibraryStore((s) => s.songs.length)
  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <Label>Songs in library</Label>
        <p className="text-2xl font-bold">{count}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Music folder</Label>
        <ChangeRootDir />
      </div>
    </div>
  )
}

export default StatsSettings
