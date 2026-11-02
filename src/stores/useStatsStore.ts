import { create } from "zustand"
import type { PlayEvent, StatsRange, StatsSummary } from "@/types/api"
import { call } from "@/lib/api"

type StatsState = {
  byRange: Partial<Record<StatsRange, StatsSummary>>
  history: PlayEvent[] | null
  /** Played > 10 times, not in the last 30 days. */
  forgotten: { songId: string; plays: number; lastPlayedAt: number }[] | null
  version: number
  loadForgotten: () => Promise<void>
  load: (range: StatsRange) => Promise<void>
  loadHistory: () => Promise<void>
}

export const useStatsStore = create<StatsState>((set) => ({
  byRange: {},
  history: null,
  forgotten: null,
  version: 0,
  loadForgotten: async () => {
    set({ forgotten: await call(window.api.stats.forgotten({ minPlays: 10, olderThanDays: 30, limit: 24 })) })
  },
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
    if (s.forgotten) void s.loadForgotten()
  })
}
