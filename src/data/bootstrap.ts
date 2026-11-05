import { call } from "@/lib/api"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { useUserStore } from "@/stores/useUserStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { startDownloadSync } from "@/stores/useDownloadStore"
import { startStatsSync } from "@/stores/useStatsStore"
import { selectMusicFolder } from "@/lib/actions"
import { startYoutubeAccessSync } from "@/components/youtube/accessStore"
import { toast } from "sonner"

// Mirror the persisted UI settings into the (non-persisted) settings store used by the views.
function syncUiSettings() {
  const s = useUserStore.getState().settings
  useSettingsStore.setState({ expandOnPlay: s.expandOnPlay, laxPlayerAutoHide: s.zenMode, zenModeTimeout: s.zenTimeout })
}

const LEGACY_MARKER = "b1t:legacyImportedAt"
/** Old localStorage keys that held user data. They are left in place as a backup. */
const LEGACY_KEYS = [
  "likedSongs",
  "recentlyPlayed",
  "userRecentlyDownloaded",
  "userRecentlyPlayedPlaylists",
  "lastRootDir",
  "musicVolume",
  "userLoopingPreferance",
  "userSettingExpandOnPlayToggle",
  "userSettingZenModeToggle",
  "userSettingZenModeTimout",
]

/**
 * One-time import of the data that used to live in this origin's localStorage.
 * The whole localStorage is sent to main, which writes a raw backup first.
 * Main also tracks imported origins, so this is safe to call repeatedly.
 */
async function importLegacyLocalStorage() {
  if (localStorage.getItem(LEGACY_MARKER)) return
  const hasAny = LEGACY_KEYS.some((k) => localStorage.getItem(k) !== null)
  if (!hasAny) {
    localStorage.setItem(LEGACY_MARKER, new Date().toISOString())
    return
  }
  const dump: Record<string, string | null> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k) dump[k] = localStorage.getItem(k)
  }
  const report = (await call(window.api.user.importLegacy(dump, window.location.origin))) as {
    skipped?: boolean
    likes: number
    recentlyPlayed: number
    unresolved: unknown[]
  }
  localStorage.setItem(LEGACY_MARKER, new Date().toISOString())
  if (report && !report.skipped) {
    toast.success("Your likes and history were moved to the new data store", {
      description: `${report.likes} likes, ${report.recentlyPlayed} recently played${report.unresolved.length ? `, ${report.unresolved.length} items couldn't be matched (kept for review)` : ""}`,
    })
  }
}

let started = false

export async function bootstrapData() {
  if (started) return
  started = true
  // Subscribe first so no change between the initial fetch and subscription is lost.
  window.api.library.onChanged((delta) => useLibraryStore.getState().applyDelta(delta))
  window.api.user.onChanged((snap) => {
    useUserStore.getState().setSnapshot(snap)
    syncUiSettings()
  })
  try {
    const [lib, user] = await Promise.all([call(window.api.library.get()), call(window.api.user.get())])
    useLibraryStore.getState().setSnapshot(lib)
    useUserStore.getState().setSnapshot(user)
    syncUiSettings()
  } catch (err) {
    toast.error("Couldn't load your library", { description: String((err as Error).message ?? err), duration: Infinity })
    return
  }
  try {
    startDownloadSync()
    void startYoutubeAccessSync()?.catch((err) => console.warn("[bootstrap] couldn't read YouTube access:", err))
    startStatsSync()
    await importLegacyLocalStorage()
  } catch (err) {
    toast.error("Couldn't import old likes/history", { description: `${(err as Error).message}. Nothing was deleted; it will retry next launch.` })
  }
  // After the legacy import, which can restore a folder of its own: this only fills in a missing one.
  try {
    const folder = await call(window.api.library.ensureDefaultFolder())
    if (folder.error) {
      toast.error("Couldn't use your Music folder", {
        description: `${folder.error} Choose a different folder to save and play music.`,
        duration: Infinity,
        action: { label: "Choose folder", onClick: () => void selectMusicFolder() },
      })
    }
  } catch (err) {
    console.warn("[bootstrap] default music folder failed:", err)
  }
}
