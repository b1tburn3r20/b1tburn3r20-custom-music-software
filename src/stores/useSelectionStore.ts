import { create } from "zustand"
import type { Song } from "@/types/DirectoryTypes"

/**
 * Multi-select of songs within one list: Ctrl/Cmd-click toggles a song,
 * Shift-click selects a range, Esc clears. Selecting in another list starts over.
 */
type SelectionState = {
  ids: Set<string>
  list: readonly Song[] | null
  anchor: number
  toggle: (list: readonly Song[], index: number) => void
  range: (list: readonly Song[], index: number) => void
  clear: () => void
  selected: () => Song[]
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  ids: new Set(),
  list: null,
  anchor: -1,
  toggle: (list, index) => {
    const s = get()
    const ids = new Set(s.list === list ? s.ids : [])
    const id = list[index].id
    if (ids.has(id)) ids.delete(id)
    else ids.add(id)
    set({ ids, list, anchor: index })
  },
  range: (list, index) => {
    const s = get()
    if (s.list !== list || s.anchor < 0) return get().toggle(list, index)
    const [a, b] = [Math.min(s.anchor, index), Math.max(s.anchor, index)]
    const ids = new Set(s.ids)
    for (let i = a; i <= b; i++) ids.add(list[i].id)
    set({ ids })
  },
  clear: () => set({ ids: new Set(), list: null, anchor: -1 }),
  selected: () => {
    const { ids, list } = get()
    return (list ?? []).filter((s) => ids.has(s.id))
  },
}))
