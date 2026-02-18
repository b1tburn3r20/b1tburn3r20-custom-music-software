import { create } from "zustand"


export type settingsStore = {
  playerExpanded: boolean
  setPlayerExpanded: (data: boolean) => void
  //
  laxPlayerAutoHide: boolean
  setLaxPlayerAutoHide: (data: boolean) => void
  zenModeTimeout: number
  setZenModeTimeout: (number: number) => void
  //
  expandOnPlay: boolean
  setExpandOnPlay: (data: boolean) => void
}



const initialState = {
  playerExpanded: false
}
const settingsInitialState = {
  laxPlayerAutoHide: true,
  zenModeTimeout: 3000,
  expandOnPlay: false,
}

export const useSettingsStore = create<settingsStore>((set) => ({
  ...initialState,
  ...settingsInitialState,
  setPlayerExpanded: (playerExpanded: boolean) => set({ playerExpanded }),
  setLaxPlayerAutoHide: (laxPlayerAutoHide: boolean) => set({ laxPlayerAutoHide }),
  setZenModeTimeout: (zenModeTimeout: number) => set({ zenModeTimeout }),
  setExpandOnPlay: (expandOnPlay: boolean) => set({ expandOnPlay }),
}))
