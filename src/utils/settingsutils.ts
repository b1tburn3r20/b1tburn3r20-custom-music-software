import { useSettingsStore } from "@/stores/useSettingsStore"

export const loadExpandOnPlayFromLocalStorage = () => {
  const setExpandOnPlay = useSettingsStore.getState().setExpandOnPlay
  const LS_KEY = "userSettingExpandOnPlayToggle"
  const key = localStorage.getItem(LS_KEY)
  if (key) {
    const val = key === "true"
    setExpandOnPlay(val)
  }
}

export const loadZenModeToggleFromLocalStorage = () => {
  const setLaxPlayerAutoHide = useSettingsStore.getState().setLaxPlayerAutoHide
  const LS_KEY = "userSettingZenModeToggle"
  const key = localStorage.getItem(LS_KEY)
  if (key) {
    const val = key === "true"
    setLaxPlayerAutoHide(val)
  }
}

export const loadZenModeTimeoutFromLocalStorage = () => {
  const setZenModeTimeout = useSettingsStore.getState().setZenModeTimeout
  const LS_KEY = "userSettingZenModeTimout"
  const key = localStorage.getItem(LS_KEY)
  if (key) {
    setZenModeTimeout(Number(key))
  }
}
