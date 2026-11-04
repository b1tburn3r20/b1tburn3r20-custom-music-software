import { toast } from "sonner"
import { call, errorMessage } from "@/lib/api"
import { useLibraryStore } from "@/stores/useLibraryStore"

const AUTH_CODES = new Set(["AUTH_EXPIRED", "AUTH_INVALID", "AUTH_FILE_MISSING", "SIGN_IN_REQUIRED", "BROWSER_COOKIES_UNAVAILABLE", "YTDLP_JS_CHALLENGE"])
export const isAuthError = (code?: string | null) => Boolean(code && AUTH_CODES.has(code))

export type EnqueueVideo = { videoId: string; title: string; channel?: string; duration?: number; /** position in the YouTube playlist (keeps mirrored playlists in order) */ index?: number }
export type EnqueueOpts = { playlistId?: string; mirror?: { youtubeId: string; title: string } }

export async function enqueueVideos(videos: EnqueueVideo[], opts?: EnqueueOpts) {
  if (!useLibraryStore.getState().rootDir) {
    toast.error("Pick a music folder first", { description: "Settings → Library → Change folder" })
    return null
  }
  try {
    return await call(window.api.youtube.enqueue(videos, opts))
  } catch (err) {
    toast.error("Couldn't start the download", { description: errorMessage(err) })
    return null
  }
}
