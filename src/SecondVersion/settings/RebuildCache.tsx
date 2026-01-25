import { Button } from "@/components/ui/button"
import { useDirectoryStore } from "@/stores/useDirectoryStore"
import { RefreshCcw } from "lucide-react"

const RebuildCache = () => {
  const rootDir = useDirectoryStore((f) => f.rootDir)
  const handleClick = async () => {
    await (window as any).electron.rebuildCache({ rootDir })
    window.location.reload()
  }
  return (
    <div>
      <Button onClick={handleClick}>
        <RefreshCcw />
      </Button>
    </div>
  )
}

export default RebuildCache
