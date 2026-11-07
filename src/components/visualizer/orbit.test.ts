import { describe, expect, it } from "vitest"
import { chaseOrb, chaseSpeed, coverRect, createBeatPulse, createFullnessMeter, lensed, orbitRadius, orbitScale, orbitSpeed } from "./scenes"

const FRAME = 1 / 60
type Meter = ReturnType<typeof createFullnessMeter>
/** Levels taken from real songs: drums alone, a verse with the band, and a wall-of-sound chorus. */
const DRUMS = { kick: [0.75, 0.55, 0.3], gap: [0.3, 0.45, 0.2] }
const VERSE = [0.58, 0.65, 0.45]
const CHORUS = [0.65, 0.67, 0.56]

/** Plays levels for a while and returns the reading for each frame. */
const play = (meter: Meter, levels: number[] | ((frame: number) => number[]), seconds: number) => {
  const out: number[] = []
  for (let i = 0; i < seconds * 60; i++) {
    const [b, m, t] = typeof levels === "function" ? levels(i) : levels
    out.push(meter(b, m, t, FRAME))
  }
  return out
}
const drums = (i: number) => (i % 30 < 8 ? DRUMS.kick : DRUMS.gap)
const last = (v: number[]) => v[v.length - 1]

describe("Orbit fullness meter", () => {
  it("barely reacts to drums on their own, however hard they hit", () => {
    expect(Math.max(...play(createFullnessMeter(), drums, 30))).toBeLessThan(0.1)
  })

  it("reaches full when the whole band comes in", () => {
    const meter = createFullnessMeter()
    play(meter, drums, 20)
    play(meter, VERSE, 30)
    expect(last(play(meter, CHORUS, 3))).toBeGreaterThan(0.9)
  })

  it("rates a verse well below the chorus", () => {
    const meter = createFullnessMeter()
    play(meter, CHORUS, 30)
    expect(last(play(meter, VERSE, 5))).toBeLessThan(0.6)
  })

  it("stays at full through a long chorus", () => {
    const meter = createFullnessMeter()
    expect(last(play(meter, CHORUS, 120))).toBeGreaterThan(0.95)
  })

  it("returns to full when the chorus comes back", () => {
    const meter = createFullnessMeter()
    play(meter, CHORUS, 30)
    play(meter, VERSE, 60)
    expect(last(play(meter, CHORUS, 3))).toBeGreaterThan(0.9)
  })

  it("isn't thrown off by a brief spike", () => {
    const meter = createFullnessMeter()
    play(meter, CHORUS, 30)
    play(meter, [0.85, 0.8, 0.7], 0.3) // about the loudest these songs get, all at once
    expect(last(play(meter, CHORUS, 3))).toBeGreaterThan(0.9)
  })

  it("lets a quieter song reach its own peak eventually", () => {
    const meter = createFullnessMeter()
    const quiet = [0.45, 0.5, 0.35]
    expect(last(play(meter, quiet, 5))).toBeLessThan(0.1)
    expect(last(play(meter, quiet, 240))).toBeGreaterThan(0.6)
  })

  it("forgets the last song's peak after a silence", () => {
    const meter = createFullnessMeter()
    play(meter, [0.8, 0.8, 0.75], 30)
    play(meter, [0, 0, 0], 2)
    expect(last(play(meter, CHORUS, 5))).toBeGreaterThan(0.9)
  })

  it("keeps its mark through a pause shorter than the gap between songs", () => {
    const meter = createFullnessMeter()
    play(meter, [0.8, 0.8, 0.75], 30)
    play(meter, [0, 0, 0], 0.3)
    expect(last(play(meter, CHORUS, 3))).toBeLessThan(0.3)
  })

  it("changes speed within about half a second when a section changes", () => {
    const meter = createFullnessMeter()
    play(meter, CHORUS, 30)
    play(meter, VERSE, 30)
    let speed = orbitSpeed(last(play(meter, VERSE, 1)), null)
    const calm = speed
    const step = (levels: number[]) => {
      for (let i = 0; i < 0.5 * 60; i++) speed = chaseSpeed(speed, orbitSpeed(meter(levels[0], levels[1], levels[2], FRAME), null), FRAME)
    }
    step(CHORUS)
    const full = orbitSpeed(last(play(createFullnessMeter(), CHORUS, 30)), null)
    expect(speed - calm).toBeGreaterThan((full - calm) * 0.85)
    step(VERSE)
    expect(speed - calm).toBeLessThan((full - calm) * 0.2)
  })

  it("holds a steady reading through a verse with kick drums on top", () => {
    const meter = createFullnessMeter()
    play(meter, CHORUS, 30)
    const verse = (i: number) => (i % 30 < 8 ? [0.72, 0.65, 0.45] : VERSE)
    const beat = play(meter, verse, 10).slice(-120)
    expect(Math.max(...beat) - Math.min(...beat)).toBeLessThan(0.1)
  })
})

describe("orbitSpeed", () => {
  const top = orbitSpeed(1, null)

  it("rushes at full and still drifts at nothing", () => {
    expect(orbitSpeed(0, null)).toBeGreaterThan(0)
    expect(orbitSpeed(0, null)).toBeLessThan(0.2)
    expect(top).toBeGreaterThan(orbitSpeed(0, null) * 20)
  })

  it("goes faster with a faster tempo, within limits", () => {
    expect(orbitSpeed(0.5, 160)).toBeGreaterThan(orbitSpeed(0.5, 100))
    expect(orbitSpeed(0.5, 1000)).toBe(orbitSpeed(0.5, 216))
  })

  it("saves most of its speed for the very top", () => {
    expect(orbitSpeed(0.5, null)).toBeLessThan(top * 0.3)
    expect(orbitSpeed(0.9, null)).toBeGreaterThan(top * 0.7)
  })
})

describe("coverRect", () => {
  it("fills the new size, keeps the shape, and stays centered", () => {
    const r = coverRect(1000, 500, 800, 800)
    expect(r.w / r.h).toBeCloseTo(2)
    expect(r.h).toBeCloseTo(800)
    expect(r.x + r.w / 2).toBeCloseTo(400)
    expect(r.y + r.h / 2).toBeCloseTo(400)
  })
  it("leaves a picture of the same size where it was", () => {
    expect(coverRect(640, 480, 640, 480)).toEqual({ x: 0, y: 0, w: 640, h: 480 })
  })
})

describe("createBeatPulse", () => {
  // Beats twice a second, with the beat value decaying as the analyser's does.
  const run = (bassAt: (beatFrame: number) => number, { locked = true, seconds = 10 } = {}) => {
    const pulse = createBeatPulse()
    const out: number[] = []
    let beat = 0
    for (let i = 0; i < seconds * 60; i++) {
      beat = i % 30 === 0 ? 1 : beat * Math.pow(0.02, FRAME)
      out.push(pulse(beat, bassAt(i % 30), locked, FRAME))
    }
    return out.slice(5 * 60) // once it has learned the song's level
  }
  const kicks = (f: number) => (f < 8 ? 0.75 : 0.3)
  const most = (v: number[]) => Math.max(...v)

  it("reacts to a real kick drum", () => {
    expect(most(run(kicks))).toBeGreaterThan(0.5)
  })
  it("ignores beats reported in steady, ambient sound", () => {
    expect(most(run(() => 0.5))).toBeLessThan(0.01)
  })
  it("ignores small noise bumps that land on a beat", () => {
    expect(most(run((f) => (f < 8 ? 0.53 : 0.47)))).toBeLessThan(0.05)
  })
  it("ignores everything until the tempo is locked", () => {
    expect(most(run(kicks, { locked: false }))).toBe(0)
  })
  it("doesn't shake as it settles when the bass flickers", () => {
    const flicker = (f: number) => (f < 8 ? 0.75 : f % 2 ? 0.34 : 0.26)
    const values = run(flicker)
    const start = values.indexOf(most(values))
    for (let i = start + 1; i < start + 15; i++) expect(values[i]).toBeLessThanOrEqual(values[i - 1])
  })
})

describe("orbitRadius", () => {
  // How far the rings reach for each unit of radius, across the slow tilt and roll of the axis.
  const angles = Array.from({ length: 200 }, (_, i) => {
    const axis = (i / 200) * Math.PI * 2
    const tilt = 0.46 + Math.cos(axis) * 0.26
    const roll = -0.42 + Math.sin(axis) * 0.5
    return { reachX: Math.hypot(Math.cos(roll), Math.sin(tilt) * Math.sin(roll)), reachY: Math.hypot(Math.sin(roll), Math.sin(tilt) * Math.cos(roll)) }
  })
  const previous = (w: number, h: number, x: number, y: number) => Math.min((w * 0.5) / x, (h * 0.5) / y)

  it("fits portrait screens to their width at any angle, and grows past it with speed", () => {
    for (const { reachX, reachY } of angles) {
      expect(orbitRadius(1080, 1920, reachX, reachY) * Math.max(reachX, reachY)).toBeCloseTo(540)
      expect(orbitRadius(1080, 1920, reachX, reachY, 1.5) * Math.max(reachX, reachY)).toBeCloseTo(810)
    }
  })
  it("makes a desktop screen's rings a bit smaller than a portrait screen with the same short side", () => {
    for (const { reachX, reachY } of angles) expect(orbitRadius(1920, 1080, reachX, reachY)).toBeCloseTo(orbitRadius(1080, 1920, reachX, reachY) * 0.85)
  })
  it("is noticeably smaller on a desktop screen than it was", () => {
    const { reachX, reachY } = angles[0]
    expect(orbitRadius(1920, 1080, reachX, reachY)).toBeLessThan(previous(1920, 1080, reachX, reachY) * 0.75)
  })
  it("doesn't jump as a window is resized past square", () => {
    const { reachX, reachY } = angles[0]
    let previousSize = orbitRadius(800, 1000, reachX, reachY)
    for (let w = 801; w <= 1500; w++) {
      const size = orbitRadius(w, 1000, reachX, reachY)
      expect(Math.abs(size - previousSize)).toBeLessThan(previousSize * 0.01)
      previousSize = size
    }
  })
  it("still grows with speed on a desktop screen", () => {
    const { reachX, reachY } = angles[0]
    expect(orbitRadius(1920, 1080, reachX, reachY, 1.5)).toBeGreaterThan(orbitRadius(1920, 1080, reachX, reachY) * 1.2)
  })
  it("doesn't grow on an ultrawide screen", () => {
    const { reachX, reachY } = angles[0]
    expect(orbitRadius(3440, 1080, reachX, reachY)).toBe(orbitRadius(1920, 1080, reachX, reachY))
  })
  it("stays inside a 16:9 screen even at full speed", () => {
    const full = orbitScale(orbitSpeed(1, null))
    for (const { reachX, reachY } of angles) {
      const radius = orbitRadius(1920, 1080, reachX, reachY, full)
      expect(radius * reachX).toBeLessThanOrEqual(960.001)
      expect(radius * reachY).toBeLessThanOrEqual(540.001)
    }
  })
})

describe("orbitScale", () => {
  it("grows with speed, up to 1.5x at full speed", () => {
    expect(orbitScale(0)).toBe(1)
    expect(orbitScale(orbitSpeed(1, null) / 2)).toBeCloseTo(1.25)
    expect(orbitScale(orbitSpeed(1, null))).toBeCloseTo(1.5)
  })

  it("stops at 1.5x when a fast tempo pushes the speed past full", () => {
    expect(orbitScale(orbitSpeed(1, 216))).toBeCloseTo(1.5)
  })
})

describe("the white hole", () => {
  const settle = (orb: number, target: number, seconds: number) => {
    for (let i = 0; i < seconds * 60; i++) orb = chaseOrb(orb, target, FRAME)
    return orb
  }

  it("snaps open within about a tenth of a second", () => {
    expect(settle(0, 1, 0.1)).toBeGreaterThan(0.95)
  })

  it("snaps shut within about a fifth of a second", () => {
    expect(settle(1, 0, 0.2)).toBeLessThan(0.05)
  })

  it("pushes things out near it, and leaves things far away nearly alone", () => {
    expect(lensed(0, 50)).toBe(50)
    expect(lensed(50, 50)).toBeGreaterThan(75)
    expect(lensed(1000, 50) - 1000).toBeLessThan(3)
  })

  it("doesn't move anything when it's gone", () => {
    expect(lensed(200, 0)).toBe(200)
  })
})

describe("chaseSpeed", () => {
  const top = orbitSpeed(1, null)
  const drift = orbitSpeed(0, null)
  const chase = (speed: number, target: number, seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) speed = chaseSpeed(speed, target, FRAME)
    return speed
  }

  it("reaches a new section within about a quarter of a second", () => {
    expect(chase(drift, top, 0.25)).toBeGreaterThan(top * 0.9)
  })

  it("falls most of the way within half a second", () => {
    expect(chase(top, drift, 0.5)).toBeLessThan(top * 0.1)
  })

  it("barely reacts to the level flickering near the top of the song", () => {
    let speed = orbitSpeed(0.9, null)
    let lowest = speed
    let highest = speed
    for (let i = 0; i < 300; i++) {
      speed = chaseSpeed(speed, orbitSpeed(i % 12 < 6 ? 0.85 : 0.95, null), FRAME)
      lowest = Math.min(lowest, speed)
      highest = Math.max(highest, speed)
    }
    expect(highest - lowest).toBeLessThan(top * 0.12)
  })
})
