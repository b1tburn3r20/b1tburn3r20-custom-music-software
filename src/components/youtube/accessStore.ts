import { create } from "zustand"
import { call } from "@/lib/api"
import type { YoutubeAccess, YoutubeAccount } from "@/types/api"

/** Which YouTube features are unlocked. Holds only yes/no facts: secrets stay in the main process. */
export const useYoutubeAccess = create<{ access: YoutubeAccess | null }>(() => ({ access: null }))

/** The user's YouTube data, once connected: their playlists, likes and subscriptions. */
export const useYoutubeAccount = create<{ account: YoutubeAccount | null }>(() => ({ account: null }))

// Each layer unlocks only its own feature: a signed-in user still needs a key to search.
export const canSearch = (a: YoutubeAccess | null) => Boolean(a?.hasApiKey)
export const canLoadData = (a: YoutubeAccess | null) => Boolean(a?.connected || a?.cookieMode)
export const isLocked = (a: YoutubeAccess | null) => !canSearch(a) && !canLoadData(a)

let started = false
export function startYoutubeAccessSync() {
  if (started) return
  started = true
  // An event is always newer than a first fetch still in flight, so it must win. Otherwise
  // adding a credential during startup could be undone by the older answer arriving later.
  let accessEvent = false
  let accountEvent = false
  window.api.youtube.onAccessChanged((access) => {
    accessEvent = true
    useYoutubeAccess.setState({ access })
  })
  window.api.youtube.onAccountChanged((account) => {
    accountEvent = true
    useYoutubeAccount.setState({ account })
  })
  return Promise.all([call(window.api.youtube.access()), call(window.api.youtube.account())]).then(([access, account]) => {
    if (!accessEvent) useYoutubeAccess.setState({ access })
    if (!accountEvent) useYoutubeAccount.setState({ account })
  })
}
