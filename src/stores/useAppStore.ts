import { create } from "zustand"

type AppStore = {
  view: string
  setView: (data: string) => void
}


const initialState = {
  view: "home"
}

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,
  setView: (view: string) => set({ view })
}))
