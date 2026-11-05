import { create } from "zustand"
export const useYoutubeTab = create<{ tab: "search" | "mine" | "downloads"; setTab: (t: "search" | "mine" | "downloads") => void }>((set) => ({ tab: "mine", setTab: (tab) => set({ tab }) }))
