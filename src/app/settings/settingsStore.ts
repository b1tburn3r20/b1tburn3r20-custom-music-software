import { create } from "zustand"

/** Lets any part of the app open Settings on a given tab. */
export const useSettingsDialog = create<{ open: boolean; tab: string; setOpen: (o: boolean) => void; setTab: (t: string) => void }>((set) => ({
  open: false,
  tab: "appearance",
  setOpen: (open) => set({ open }),
  setTab: (tab) => set({ tab }),
}))

export const openSettings = (tab?: string) => useSettingsDialog.setState((s) => ({ open: true, tab: tab ?? s.tab }))
