import { create } from "zustand"
export const useYoutubeTab = create<{ tab: "search" | "mine" | "downloads"; setTab: (t: "search" | "mine" | "downloads") => void }>((set) => ({ tab: "search", setTab: (tab) => set({ tab }) }))
