// Pure queue model. No React, no audio — just data in, data out, so every
// behavior (context playback, shuffle, repeat, play next, removal) is unit tested.
//
// `items` is the queue in its original (context) order. `order` is the playback
// order as indexes into `items` — identity when shuffle is off, a permutation
// when it's on. `pos` is the position in `order` of the current item.

export type RepeatMode = "off" | "all" | "one"
export type QueueContextType = "playlist" | "album" | "artist" | "liked" | "search" | "list" | "radio" | "history" | "downloads"
export type QueueContext = { type: QueueContextType; id?: string; label: string }
export type QueueItem = { uid: string; songId: string; /** added via Play next / Add to queue / radio */ source?: "context" | "user" | "radio" }

export type QueueState = {
  items: QueueItem[]
  order: number[]
  pos: number
  context: QueueContext | null
  shuffle: boolean
  repeat: RepeatMode
}

export const emptyQueue = (shuffle = false, repeat: RepeatMode = "all"): QueueState => ({ items: [], order: [], pos: -1, context: null, shuffle, repeat })

let uidCounter = 0
export const newUid = () => `q${Date.now().toString(36)}-${(uidCounter++).toString(36)}`

type Rand = () => number

function shuffleInPlace<T>(arr: T[], rand: Rand): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const identity = (n: number) => Array.from({ length: n }, (_, i) => i)

export function currentItem(q: QueueState): QueueItem | null {
  if (q.pos < 0 || q.pos >= q.order.length) return null
  return q.items[q.order[q.pos]] ?? null
}
export const currentSongId = (q: QueueState) => currentItem(q)?.songId ?? null

/** Items after the current one, in playback order. */
export function upcoming(q: QueueState): QueueItem[] {
  return q.order.slice(q.pos + 1).map((i) => q.items[i])
}
/** Items before the current one, in playback order. */
export function history(q: QueueState): QueueItem[] {
  return q.order.slice(0, Math.max(0, q.pos)).map((i) => q.items[i])
}

/**
 * Replace the queue with a whole list (playlist, album, search results…),
 * starting at `startIndex`. Next/previous continue in both directions from there.
 */
export function playContext(q: QueueState, songIds: string[], startIndex: number, context: QueueContext | null, rand: Rand = Math.random): QueueState {
  if (!songIds.length) return { ...q, items: [], order: [], pos: -1, context }
  const start = Math.min(Math.max(0, startIndex), songIds.length - 1)
  const items = songIds.map((songId) => ({ uid: newUid(), songId, source: "context" as const }))
  if (q.shuffle) {
    const rest = shuffleInPlace(identity(items.length).filter((i) => i !== start), rand)
    return { ...q, items, order: [start, ...rest], pos: 0, context }
  }
  return { ...q, items, order: identity(items.length), pos: start, context }
}

export type Advance = { queue: QueueState; ended: boolean; restart: boolean }

/**
 * Move to the next item. `auto` = the track finished on its own (repeat-one only
 * applies then; a manual "next" always advances).
 */
export function next(q: QueueState, { auto = false }: { auto?: boolean } = {}, rand: Rand = Math.random): Advance {
  if (!q.order.length) return { queue: q, ended: true, restart: false }
  if (auto && q.repeat === "one") return { queue: q, ended: false, restart: true }
  if (q.pos + 1 < q.order.length) return { queue: { ...q, pos: q.pos + 1 }, ended: false, restart: false }
  if (q.repeat === "all") {
    if (q.order.length === 1) return { queue: q, ended: false, restart: true }
    // Reshuffle for the next round, but never start the round with the song that just played.
    if (q.shuffle) {
      const last = q.order[q.pos]
      const rest = shuffleInPlace(q.order.filter((i) => i !== last), rand)
      return { queue: { ...q, order: [...rest, last], pos: 0 }, ended: false, restart: false }
    }
    return { queue: { ...q, pos: 0 }, ended: false, restart: false }
  }
  return { queue: q, ended: true, restart: false }
}

export function prev(q: QueueState): Advance {
  if (!q.order.length) return { queue: q, ended: false, restart: false }
  if (q.pos > 0) return { queue: { ...q, pos: q.pos - 1 }, ended: false, restart: false }
  if (q.repeat === "all" && q.order.length > 1) return { queue: { ...q, pos: q.order.length - 1 }, ended: false, restart: false }
  return { queue: q, ended: false, restart: true }
}

function appendItems(q: QueueState, songIds: string[], source: QueueItem["source"]) {
  const base = q.items.length
  const added = songIds.map((songId) => ({ uid: newUid(), songId, source }))
  return { items: [...q.items, ...added], newIdx: added.map((_, i) => base + i) }
}

/** Insert right after the current item (in playback order). */
export function playNext(q: QueueState, songIds: string[]): QueueState {
  if (!songIds.length) return q
  const { items, newIdx } = appendItems(q, songIds, "user")
  if (q.pos < 0) return { ...q, items, order: newIdx, pos: 0 }
  const order = [...q.order.slice(0, q.pos + 1), ...newIdx, ...q.order.slice(q.pos + 1)]
  return { ...q, items, order }
}

/** Append to the end of the queue. */
export function addToQueue(q: QueueState, songIds: string[], source: QueueItem["source"] = "user"): QueueState {
  if (!songIds.length) return q
  const { items, newIdx } = appendItems(q, songIds, source)
  if (q.pos < 0) return { ...q, items, order: newIdx, pos: 0 }
  return { ...q, items, order: [...q.order, ...newIdx] }
}

/**
 * Remove items matching `pred`. If the current item is removed, the item that
 * followed it becomes current (or the queue ends). Returns whether the current item changed.
 */
export function removeWhere(q: QueueState, pred: (item: QueueItem) => boolean): { queue: QueueState; currentChanged: boolean } {
  const cur = currentItem(q)
  const keep = q.items.map((it) => !pred(it))
  if (keep.every(Boolean)) return { queue: q, currentChanged: false }
  const remap = new Map<number, number>()
  const items: QueueItem[] = []
  q.items.forEach((it, i) => {
    if (keep[i]) {
      remap.set(i, items.length)
      items.push(it)
    }
  })
  let pos = q.pos
  const order: number[] = []
  q.order.forEach((idx, p) => {
    if (remap.has(idx)) order.push(remap.get(idx)!)
    else if (p < q.pos) pos--
  })
  // pos now points at the next surviving item if the current one was removed
  if (!order.length) return { queue: { ...q, items: [], order: [], pos: -1 }, currentChanged: Boolean(cur) }
  const currentRemoved = cur ? pred(cur) : false
  if (pos >= order.length) pos = currentRemoved ? (q.repeat === "all" ? 0 : order.length - 1) : order.length - 1
  const queue = { ...q, items, order, pos: Math.max(0, pos) }
  return { queue, currentChanged: currentRemoved }
}

export const removeUid = (q: QueueState, uid: string) => removeWhere(q, (it) => it.uid === uid)
export const removeSongs = (q: QueueState, ids: Set<string>) => removeWhere(q, (it) => ids.has(it.songId))

export function jumpTo(q: QueueState, uid: string): QueueState {
  const idx = q.items.findIndex((it) => it.uid === uid)
  if (idx === -1) return q
  const p = q.order.indexOf(idx)
  return p === -1 ? q : { ...q, pos: p }
}

/**
 * Shuffle on: the current song stays current, everything already played stays
 * in history, and only the upcoming songs are shuffled.
 * Shuffle off: back to the original order, continuing from the current song.
 */
export function setShuffle(q: QueueState, on: boolean, rand: Rand = Math.random): QueueState {
  if (on === q.shuffle) return q
  if (q.pos < 0) return { ...q, shuffle: on }
  const cur = q.order[q.pos]
  if (on) {
    const played = q.order.slice(0, q.pos + 1)
    const rest = shuffleInPlace(q.order.slice(q.pos + 1), rand)
    return { ...q, shuffle: true, order: [...played, ...rest] }
  }
  return { ...q, shuffle: false, order: identity(q.items.length), pos: cur }
}

export const setRepeat = (q: QueueState, repeat: RepeatMode): QueueState => ({ ...q, repeat })
export const cycleRepeat = (r: RepeatMode): RepeatMode => (r === "off" ? "all" : r === "all" ? "one" : "off")

export function songIdsInPlayOrder(q: QueueState): string[] {
  return q.order.map((i) => q.items[i].songId)
}
