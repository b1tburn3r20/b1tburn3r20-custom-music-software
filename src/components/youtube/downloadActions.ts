import { toast } from "sonner"
import { call, errorMessage } from "@/lib/api"
import { useLibraryStore } from "@/stores/useLibraryStore"

const AUTH_CODES = new Set(["AUTH_EXPIRED", "AUTH_INVALID", "AUTH_FILE_MISSING", "SIGN_IN_REQUIRED", "BROWSER_COOKIES_UNAVAILABLE", "YTDLP_JS_CHALLENGE", "YTDLP_MISSING", "FOLDER_NOT_WRITABLE"])
export const isAuthError = (code?: string | null) => Boolean(code && AUTH_CODES.has(code))

export type EnqueueVideo = { videoId: string; title: string; channel?: string; duration?: number; /** position in the YouTube playlist (keeps mirrored playlists in order) */ index?: number }
export type EnqueueOpts = { playlistId?: string; mirror?: { youtubeId: string; title: string } }

/** Tells the user straight away, then reads each playlist and queues its songs without holding up the page. */
export async function scheduleImport({ videos = [], playlists }: { videos?: EnqueueVideo[]; playlists: { id: string; title: string }[] }) {
  const toastId = toast.loading("Import scheduled", { description: "Your music is importing in the background. Feel free to keep browsing." })
  const failed: string[] = []
  let queued = 0
  const add = (items: { status: string }[] | undefined) => {
    queued += (items ?? []).filter((i) => i.status !== "skipped").length
  }
  if (videos.length) add((await enqueueVideos(videos))?.items)
  for (const p of playlists) {
    try {
      const { videos: found } = await call(window.api.youtube.playlistItems(p.id))
      const res = await enqueueVideos(
        found.flatMap((v, index) => (v.unavailable ? [] : [{ videoId: v.id, title: v.title, channel: v.channel, duration: v.duration, index }])),
        { mirror: { youtubeId: p.id, title: p.title } },
      )
      if (res) add(res.items)
      else failed.push(p.title)
    } catch {
      failed.push(p.title)
    }
  }
  const songs = `${queued} ${queued === 1 ? "song" : "songs"}`
  if (failed.length) toast.error(`Couldn't import ${failed.join(", ")}`, { id: toastId, description: `${songs} queued. You can try again from the YouTube page.` })
  else if (queued) toast.success(`Importing ${songs}`, { id: toastId, description: "Keep browsing. You can watch progress on the Downloads page." })
  else toast.success("Nothing new to import", { id: toastId, description: "You already have all of it." })
}

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
