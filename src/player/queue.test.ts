import { describe, expect, it } from "vitest"
import * as Q from "./queue"

const ids = ["a", "b", "c", "d", "e"]
const ctx: Q.QueueContext = { type: "playlist", id: "p1", label: "Mix" }
// deterministic "random": always picks index 0 → reverses order
const rand = () => 0
const cur = (q: Q.QueueState) => Q.currentSongId(q)
const playOrder = (q: Q.QueueState) => Q.songIdsInPlayOrder(q).join("")

describe("radioSeedId", () => {
  it("keeps a radio's own seed, whatever is playing", () => {
    const q = Q.playContext(Q.emptyQueue(), ["a", "b"], 1, { type: "radio", id: "a", label: "a radio" })
    expect(Q.radioSeedId(q)).toBe("a")
  })
  it("after a list, stays on the last song you chose while suggestions play", () => {
    let q = Q.playContext(Q.emptyQueue(), ["a", "b"], 1, ctx)
    q = Q.addToQueue(q, ["r1", "r2"], "radio")
    expect(Q.radioSeedId(q)).toBe("b")
    q = { ...q, pos: q.pos + 2 }
    expect(cur(q)).toBe("r2")
    expect(Q.radioSeedId(q)).toBe("b")
  })
})

describe("playContext", () => {
  it("queues the whole list and starts at the clicked song", () => {
    const q = Q.playContext(Q.emptyQueue(), ids, 2, ctx)
    expect(cur(q)).toBe("c")
    expect(q.items).toHaveLength(5)
    expect(q.context).toEqual(ctx)
  })

  it("continues in both directions from the clicked song", () => {
    let q = Q.playContext(Q.emptyQueue(false, "off"), ids, 2, ctx)
    q = Q.next(q).queue
    expect(cur(q)).toBe("d")
    q = Q.prev(Q.prev(q).queue).queue
    expect(cur(q)).toBe("b")
    q = Q.prev(q).queue
    expect(cur(q)).toBe("a")
    const atStart = Q.prev(q)
    expect(atStart.restart).toBe(true) // repeat off: previous at the start restarts the song
    expect(cur(atStart.queue)).toBe("a")
  })

  it("with shuffle on, the clicked song plays first and every song is included once", () => {
    const q = Q.playContext(Q.emptyQueue(true), ids, 3, ctx, rand)
    expect(cur(q)).toBe("d")
    expect([...Q.songIdsInPlayOrder(q)].sort().join("")).toBe("abcde")
  })

  it("handles an empty list", () => {
    const q = Q.playContext(Q.emptyQueue(), [], 0, ctx)
    expect(cur(q)).toBeNull()
  })

  it("keeps duplicate songs as distinct queue entries", () => {
    let q = Q.playContext(Q.emptyQueue(false, "off"), ["a", "b", "a"], 0, ctx)
    q = Q.next(Q.next(q).queue).queue
    expect(cur(q)).toBe("a")
    expect(q.pos).toBe(2)
    expect(Q.next(q).ended).toBe(true)
  })
})

describe("repeat", () => {
  it("off: ends after the last song", () => {
    const q = Q.playContext(Q.emptyQueue(false, "off"), ids, 4, ctx)
    const r = Q.next(q, { auto: true })
    expect(r.ended).toBe(true)
  })
  it("all: wraps to the first song, and previous wraps to the last", () => {
    const q = Q.playContext(Q.emptyQueue(false, "all"), ids, 4, ctx)
    expect(cur(Q.next(q, { auto: true }).queue)).toBe("a")
    const first = Q.playContext(Q.emptyQueue(false, "all"), ids, 0, ctx)
    expect(cur(Q.prev(first).queue)).toBe("e")
  })
  it("one: restarts the same song when it ends, but manual next still advances", () => {
    const q = Q.playContext(Q.emptyQueue(false, "one"), ids, 1, ctx)
    const auto = Q.next(q, { auto: true })
    expect(auto.restart).toBe(true)
    expect(cur(auto.queue)).toBe("b")
    expect(cur(Q.next(q).queue)).toBe("c")
  })
  it("all + shuffle: reshuffles for the next round without repeating the last song first", () => {
    let q = Q.playContext(Q.emptyQueue(true, "all"), ids, 0, ctx, rand)
    for (let i = 0; i < 4; i++) q = Q.next(q, {}, rand).queue
    const last = cur(q)
    q = Q.next(q, {}, rand).queue
    expect(q.pos).toBe(0)
    expect(cur(q)).not.toBe(last)
    expect([...Q.songIdsInPlayOrder(q)].sort().join("")).toBe("abcde")
  })
})

describe("shuffle toggle", () => {
  it("turning shuffle on keeps the current song and history, shuffles only upcoming", () => {
    let q = Q.playContext(Q.emptyQueue(false, "off"), ids, 1, ctx)
    q = Q.setShuffle(q, true, rand)
    expect(cur(q)).toBe("b")
    expect(Q.history(q).map((i) => i.songId)).toEqual(["a"])
    expect(Q.upcoming(q).map((i) => i.songId).sort()).toEqual(["c", "d", "e"])
  })
  it("turning shuffle off restores the original order from the current song", () => {
    let q = Q.playContext(Q.emptyQueue(true, "off"), ids, 3, ctx, rand) // starts at d
    q = Q.next(q, {}, rand).queue
    const now = cur(q)!
    q = Q.setShuffle(q, false)
    expect(cur(q)).toBe(now)
    expect(playOrder(q)).toBe("abcde")
    expect(Q.upcoming(q).map((i) => i.songId)).toEqual(ids.slice(ids.indexOf(now) + 1))
  })
})

describe("play next / add to queue", () => {
  it("play next inserts right after the current song", () => {
    let q = Q.playContext(Q.emptyQueue(false, "off"), ids, 1, ctx)
    q = Q.playNext(q, ["x", "y"])
    expect(Q.upcoming(q).map((i) => i.songId).slice(0, 3)).toEqual(["x", "y", "c"])
    q = Q.next(q).queue
    expect(cur(q)).toBe("x")
  })
  it("play next works while shuffled and survives turning shuffle off", () => {
    let q = Q.playContext(Q.emptyQueue(true, "off"), ids, 0, ctx, rand)
    q = Q.playNext(q, ["x"])
    expect(Q.upcoming(q)[0].songId).toBe("x")
    q = Q.setShuffle(q, false)
    expect(Q.songIdsInPlayOrder(q)).toContain("x")
  })
  it("add to queue appends to the end", () => {
    let q = Q.playContext(Q.emptyQueue(false, "off"), ids, 0, ctx)
    q = Q.addToQueue(q, ["z"])
    expect(Q.upcoming(q).at(-1)?.songId).toBe("z")
  })
  it("adding to an empty queue starts it", () => {
    const q = Q.addToQueue(Q.emptyQueue(), ["z"])
    expect(cur(q)).toBe("z")
  })
})

describe("remove / jump", () => {
  it("removing an upcoming item keeps the current song", () => {
    let q = Q.playContext(Q.emptyQueue(false, "off"), ids, 1, ctx)
    const d = q.items.find((i) => i.songId === "d")!
    const r = Q.removeUid(q, d.uid)
    q = r.queue
    expect(r.currentChanged).toBe(false)
    expect(cur(q)).toBe("b")
    expect(playOrder(q)).toBe("abce")
  })
  it("removing a played item keeps the position on the current song", () => {
    const q = Q.playContext(Q.emptyQueue(false, "off"), ids, 3, ctx)
    const r = Q.removeWhere(q, (i) => i.songId === "a")
    expect(cur(r.queue)).toBe("d")
  })
  it("removing the current song moves to the following one", () => {
    const q = Q.playContext(Q.emptyQueue(false, "off"), ids, 2, ctx)
    const r = Q.removeSongs(q, new Set(["c"]))
    expect(r.currentChanged).toBe(true)
    expect(cur(r.queue)).toBe("d")
  })
  it("removing the last song while it plays falls back to the previous one (repeat off)", () => {
    const q = Q.playContext(Q.emptyQueue(false, "off"), ids, 4, ctx)
    const r = Q.removeSongs(q, new Set(["e"]))
    expect(cur(r.queue)).toBe("d")
  })
  it("removing every song empties the queue", () => {
    const q = Q.playContext(Q.emptyQueue(), ["a"], 0, ctx)
    const r = Q.removeSongs(q, new Set(["a"]))
    expect(cur(r.queue)).toBeNull()
    expect(r.currentChanged).toBe(true)
  })
  it("jumpTo selects an item by uid", () => {
    const q = Q.playContext(Q.emptyQueue(), ids, 0, ctx)
    const e = q.items[4]
    expect(cur(Q.jumpTo(q, e.uid))).toBe("e")
  })
})
