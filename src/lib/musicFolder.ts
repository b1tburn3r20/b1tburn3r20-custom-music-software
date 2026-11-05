import { call, errorMessage } from "@/lib/api"
import { toast } from "sonner"

export function openMusicFolder() {
  call(window.api.library.openFolder()).catch((err) => toast.error("Couldn't open the folder", { description: errorMessage(err) }))
}

/** Just the name, since a full path doesn't fit a sentence. */
export function folderName(rootDir: string | null | undefined) {
  if (!rootDir) return ""
  return rootDir.split(/[\\/]/).filter(Boolean).pop() ?? rootDir
}
