import { create } from "zustand"
import type { PlayEvent, StatsRange, StatsSummary } from "@/types/api"
import { call } from "@/lib/api"

type StatsState = {
  byRange: Partial<Record<StatsRange, StatsSummary>>
  history: PlayEvent[] | null
  version: number
  load: (range: StatsRange) => Promise<void>
  loadHistory: () => Promise<void>
}

export const useStatsStore = create<StatsState>((set) => ({
  byRange: {},
  history: null,
  version: 0,
  load: async (range) => {
    const s = await call(window.api.stats.get(range))
    set((st) => ({ byRange: { ...st.byRange, [range]: s } }))
  },
  loadHistory: async () => {
    set({ history: await call(window.api.stats.history({ limit: 500 })) })
  },
}))

let started = false
/** Refresh whatever is loaded when a play is recorded or a song is deleted. */
export function startStatsSync() {
  if (started) return
  started = true
  window.api.stats.onChanged(() => {
    const s = useStatsStore.getState()
    useStatsStore.setState({ version: s.version + 1 })
    for (const r of Object.keys(s.byRange) as StatsRange[]) void s.load(r)
    if (s.history) void s.loadHistory()
  })
}
