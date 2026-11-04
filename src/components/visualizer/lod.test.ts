import { describe, expect, it } from "vitest"
import { lodHeight } from "./scenes"

// A bumpy, deterministic test terrain.
const vh = (j: number, k: number) => Math.sin(j * 1.7 + k * 0.3) * 3 + Math.cos(k * 2.1 - j) * 2 + ((j * 7 + k * 13) % 5)

/**
 * Height of the coarse mesh (cells S wide) at grid point (j, k), triangulated the
 * same way Tundra's strip loop splits cells: a cell is numbered by its right-hand
 * column jr and near row kn; when (jr/S + kn/S) is odd the diagonal runs from
 * near-left to far-right, otherwise from far-left to near-right.
 */
function coarseSurface(j: number, k: number, S: number) {
  const jl = Math.floor(j / S) * S
  const kn = Math.floor(k / S) * S
  const u = (j - jl) / S // 0 at left, 1 at right
  const v = (k - kn) / S // 0 at near, 1 at far
  const [h00, h10, h01, h11] = [vh(jl, kn), vh(jl + S, kn), vh(jl, kn + S), vh(jl + S, kn + S)]
  const odd = ((jl + S) / S + kn / S) & 1
  if (odd) {
    // diagonal near-left (0,0) → far-right (1,1)
    return u >= v ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v
  }
  // diagonal far-left (0,1) → near-right (1,0)
  return u + v <= 1 ? h00 + (h10 - h00) * u + (h01 - h00) * v : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v)
}

describe("lodHeight (terrain level-of-detail morphing)", () => {
  it("leaves vertices alone away from a level boundary", () => {
    for (let j = -6; j < 6; j++) for (let k = 0; k < 8; k++) expect(lodHeight(vh, j, k, 1, 40, 16)).toBe(vh(j, k))
  })

  it.each([1, 2, 4])("lands exactly on the coarser mesh at the boundary (step %i): no cracks", (step) => {
    const S = step * 2
    for (let j = -16; j <= 16; j += step)
      for (let k = 0; k <= 16; k += step) expect(lodHeight(vh, j, k, step, 0, 16)).toBeCloseTo(coarseSurface(j, k, S), 9)
  })

  it("glides there smoothly as the boundary approaches: no pop", () => {
    for (const [j, k] of [[3, 4], [4, 3], [3, 5], [-5, 1]]) {
      let prev = lodHeight(vh, j, k, 1, 30, 16)
      let maxStep = 0
      for (let d = 30; d >= 0; d -= 0.1) {
        const y = lodHeight(vh, j, k, 1, d, 16)
        maxStep = Math.max(maxStep, Math.abs(y - prev))
        prev = y
      }
      const total = Math.abs(coarseSurface(j, k, 2) - vh(j, k))
      // 0.1 units of travel never moves a vertex more than a small share of the whole change.
      expect(maxStep).toBeLessThanOrEqual(total * 0.012 + 1e-9)
    }
  })

  it("keeps the coarsest level as is", () => {
    expect(lodHeight(vh, 3, 5, 8, null, 16)).toBe(vh(3, 5))
  })
})
