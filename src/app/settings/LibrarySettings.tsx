import { Card } from "@/components/base/Layout"
import ChangeRootDir from "@/components/Folders/ChangeRootDir"
import { useLibraryStore } from "@/stores/useLibraryStore"

export default function LibrarySettings() {
  const count = useLibraryStore((s) => s.songs.length)
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-sm text-muted-foreground">Songs in library</p>
        <p className="text-2xl font-bold">{count}</p>
      </Card>
      <Card className="flex flex-col gap-2">
        <p className="text-sm font-medium">Music folder</p>
        <ChangeRootDir />
      </Card>
    </div>
  )
}
