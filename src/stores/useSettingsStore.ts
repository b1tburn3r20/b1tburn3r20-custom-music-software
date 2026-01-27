import { create } from "zustand"


export type settingsStore = {
  playerExpanded: boolean
  setPlayerExpanded: (data: boolean) => void

}



const initialState = {
  playerExpanded: false
}

export const useSettingsStore = create<settingsStore>((set) => ({
  ...initialState,
  setPlayerExpanded: (playerExpanded: boolean) => set({ playerExpanded }),
}))
