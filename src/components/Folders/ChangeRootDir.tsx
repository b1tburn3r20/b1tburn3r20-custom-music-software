import { Button } from "@/components/ui/button"
import { rescanLibrary, selectMusicFolder } from "@/lib/actions"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { Folder, RefreshCcw, Smartphone } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

const ChangeRootDir = () => {
  const rootDir = useLibraryStore((s) => s.rootDir)
  const [busy, setBusy] = useState<null | "folder" | "scan" | "sync">(null)
  const [syncMessage, setSyncMessage] = useState("")

  useEffect(() => {
    return window.api.sync.onProgress((data) => {
      if (data.status === "syncing" || data.status === "cleaning") setSyncMessage(data.message)
      else if (data.status === "error") toast.error("Phone sync error", { description: data.message })
    })
  }, [])

  const run = async (kind: "folder" | "scan", fn: () => Promise<unknown>) => {
    setBusy(kind)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  const handleSync = async () => {
    if (!rootDir) {
      toast.error("No music folder selected")
      return
    }
    setBusy("sync")
    setSyncMessage("Checking device connection…")
    try {
      const conn = await window.api.sync.checkAdb()
      if (!conn.success) {
        toast.error("Phone not ready", { description: conn.error })
        return
      }
      const result = await window.api.sync.toPhone({ rootPath: rootDir })
      if (result.success) toast.success("Sync complete", { description: result.message })
      else toast.error("Sync finished with errors", { description: result.error || result.message })
    } catch (err) {
      toast.error("Sync failed", { description: (err as Error).message })
    } finally {
      setBusy(null)
      setSyncMessage("")
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground truncate" title={rootDir ?? undefined}>
        {rootDir ?? "No music folder selected"}
      </p>
      <div className="flex gap-2 flex-wrap">
        <Button variant="secondary" disabled={busy !== null} onClick={() => run("folder", selectMusicFolder)}>
          <Folder /> {busy === "folder" ? "Scanning…" : "Change folder"}
        </Button>
        <Button variant="secondary" disabled={busy !== null || !rootDir} onClick={() => run("scan", rescanLibrary)}>
          <RefreshCcw className={busy === "scan" ? "animate-spin" : ""} /> Rescan
        </Button>
        <Button variant="secondary" disabled={busy !== null || !rootDir} onClick={handleSync} title={syncMessage || "Sync to phone over ADB"}>
          <Smartphone className={busy === "sync" ? "animate-pulse" : ""} /> {busy === "sync" ? syncMessage || "Syncing…" : "Sync to phone"}
        </Button>
      </div>
    </div>
  )
}

export default ChangeRootDir
