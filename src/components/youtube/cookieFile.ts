import { call } from "@/lib/api"
import { toast } from "sonner"
import { useYoutubeAccess } from "./accessStore"
import { useMyPlaylistsStore } from "./myPlaylistsStore"

/** Opens the file picker and stores the file. Resolves true if a file was imported. */
export async function chooseCookiesFile(): Promise<boolean> {
  const result = await call(window.api.youtube.importCookies())
  if (!result) return false
  toast.success("Cookies added", { description: `You can now delete “${result.imported}” from wherever you saved it.` })
  // Whatever was loaded before belongs to the previous file's account.
  if (!useYoutubeAccess.getState().access?.connected) void useMyPlaylistsStore.getState().loadPlaylists("file", true)
  return true
}
