import { create } from "zustand"

/** How many requests are out, for the bar along the top of the window. */
export const useTopProgress = create<{ active: number }>(() => ({ active: 0 }))

/** Shows the top progress bar until this finishes, whichever way it ends. */
export function trackProgress<T>(work: Promise<T>): Promise<T> {
  useTopProgress.setState((s) => ({ active: s.active + 1 }))
  return work.finally(() => useTopProgress.setState((s) => ({ active: Math.max(0, s.active - 1) })))
}

/** These requests report no percentage, so the bar eases toward this and finishes when they do. */
export const PROGRESS_CEILING = 90

/** The next width: quick at first, then slower and slower, never reaching the ceiling. */
export const nextProgress = (width: number) => width + (PROGRESS_CEILING - width) * 0.12
