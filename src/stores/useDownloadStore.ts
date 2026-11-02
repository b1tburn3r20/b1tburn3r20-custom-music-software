import { create } from "zustand"
import type { DownloadItem } from "@/types/api"
import { call } from "@/lib/api"

type DownloadState = { byId: Record<string, DownloadItem>; apply: (item: DownloadItem) => void; set: (items: DownloadItem[]) => void }

/** Mirror of the main-process download queue. */
export const useDownloadStore = create<DownloadState>((set) => ({
  byId: {},
  apply: (item) => set((s) => ({ byId: { ...s.byId, [item.videoId]: item } })),
  set: (items) => set({ byId: Object.fromEntries(items.map((i) => [i.videoId, i])) }),
}))

let started = false
export function startDownloadSync() {
  if (started) return
  started = true
  window.api.youtube.onDownloadUpdate((item) => useDownloadStore.getState().apply(item))
  call(window.api.youtube.downloads()).then((items) => useDownloadStore.getState().set(items), () => {})
}

export const isActive = (i?: DownloadItem) => i?.status === "queued" || i?.status === "downloading"
