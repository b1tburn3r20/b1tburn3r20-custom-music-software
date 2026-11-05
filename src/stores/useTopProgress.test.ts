import { describe, expect, it } from "vitest"
import { nextProgress, PROGRESS_CEILING, trackProgress, useTopProgress } from "./useTopProgress"

describe("nextProgress", () => {
  it("moves quickly at first, then slows down, and never claims to be finished", () => {
    let width = 0
    const first = nextProgress(width) - width
    for (let i = 0; i < 500; i++) width = nextProgress(width)
    expect(first).toBeGreaterThan(5)
    expect(width).toBeLessThanOrEqual(PROGRESS_CEILING)
    expect(nextProgress(80) - 80).toBeLessThan(first)
  })
})

describe("trackProgress", () => {
  it("counts requests that overlap, and clears when they finish or fail", async () => {
    let finish = () => {}
    const a = trackProgress(new Promise<void>((r) => (finish = r)))
    const b = trackProgress(Promise.reject(new Error("nope")))
    expect(useTopProgress.getState().active).toBe(2)
    await b.catch(() => {})
    expect(useTopProgress.getState().active).toBe(1)
    finish()
    await a
    expect(useTopProgress.getState().active).toBe(0)
  })
  it("passes the result straight through", async () => {
    await expect(trackProgress(Promise.resolve(5))).resolves.toBe(5)
  })
})
