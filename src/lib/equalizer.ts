// The equalizer's bands and presets. The audio itself is wired up in src/player/analyser.ts.

/** Center frequencies in Hz: the classic ten bands, one octave apart. */
export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const
export const EQ_MAX_DB = 12
export const EQ_FLAT: number[] = EQ_BANDS.map(() => 0)

export const EQ_PRESETS: { id: string; label: string; gains: number[] }[] = [
  { id: "flat", label: "Flat", gains: EQ_FLAT },
  { id: "bass", label: "Bass boost", gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
  { id: "treble", label: "Treble boost", gains: [0, 0, 0, 0, 0, 0, 1, 3, 5, 6] },
  { id: "vocal", label: "Vocals", gains: [-2, -2, -1, 1, 3, 4, 3, 2, 0, -1] },
  { id: "rock", label: "Rock", gains: [5, 3, 2, -1, -2, -1, 2, 3, 4, 5] },
  { id: "electronic", label: "Electronic", gains: [5, 4, 2, 0, -2, 0, 1, 2, 4, 5] },
  { id: "hiphop", label: "Hip hop", gains: [6, 5, 2, 1, -1, -1, 1, 0, 2, 3] },
  { id: "acoustic", label: "Acoustic", gains: [3, 2, 1, 1, 2, 1, 2, 2, 2, 1] },
  { id: "night", label: "Late night", gains: [-3, -2, -1, 0, 1, 2, 2, 1, -1, -3] },
]

/** The preset these settings are exactly, or null if they've been adjusted by hand. */
export function matchingPreset(gains: readonly number[]): string | null {
  return EQ_PRESETS.find((p) => p.gains.every((g, i) => g === gains[i]))?.id ?? null
}

/** Always ten usable numbers, whatever was saved. */
export function cleanGains(gains: unknown): number[] {
  const list = Array.isArray(gains) ? gains : []
  return EQ_BANDS.map((_, i) => {
    const n = Number(list[i])
    return Number.isFinite(n) ? Math.max(-EQ_MAX_DB, Math.min(EQ_MAX_DB, n)) : 0
  })
}

/** Turns everything down by the largest boost, so boosting a band can't make the audio clip. */
export function eqPreamp(gains: readonly number[]): number {
  const boost = Math.max(0, ...gains)
  return Math.pow(10, -boost / 20)
}

export const bandLabel = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : String(hz))
