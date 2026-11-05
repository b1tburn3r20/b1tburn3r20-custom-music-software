// Visualizer scenes: plain Canvas 2D, driven by an AudioFrame each animation frame.
// Every scene draws on a dark, album-tinted background and keeps its own state.
import { BINS, type AudioFrame } from "@/player/analyser"
import { songFullness, songPeak } from "@/player/songFullness"
import { albumColors } from "./swatches"

/** An HSL color (h in degrees, s/l 0..100). */
export type Hsl = { h: number; s: number; l: number }
/** Base color from the album art, plus its main colors (most common first; empty without art). */
export type Palette = Hsl & { swatches: Hsl[] }

export type Scene = {
  resize(w: number, h: number): void
  draw(ctx: CanvasRenderingContext2D, f: AudioFrame, p: Palette): void
}

export type SceneId = "tunnel" | "orbit" | "nighttime" | "drift"
export type SceneInfo = {
  id: SceneId
  label: string
  description: string
  /** Calm scenes stay in the background: no flashes, slow motion. */
  calm: boolean
}
export const SCENES: SceneInfo[] = [
  { id: "tunnel", label: "Tunnel", description: "The waveform as a ring that echoes into an endless, spinning tunnel.", calm: false },
  { id: "orbit", label: "Orbit", description: "Thousands of dots in tilted rings around nothing, like the disc of a black hole. They race when the song is at its fullest.", calm: false },
  { id: "nighttime", label: "Nighttime", description: "Gliding over moonlit ice under the northern lights. The music sets the pace.", calm: true },
  { id: "drift", label: "Drift", description: "Soft glows in the colors of the cover art, flowing gently with the song.", calm: true },
]

const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h % 360}, ${s}%, ${l}%, ${a})`


/** The cover's own colors (see albumColors), or the theme's fallback color with no readable cover. */
function coverColors(p: Palette): Hsl[] {
  const album = albumColors(p.swatches)
  return album.length ? album : [p]
}
/** A cover color lifted into a visible range: a dark swatch would vanish against the background. */
const paint = (c: Hsl, a = 1, lift = 0) => hsl(c.h, c.s, Math.min(85, Math.max(45, Math.min(75, c.l)) + lift), a)

// ---------------------------------------------------------------------------
// Tunnel: feedback zoom. Each frame redraws the previous one slightly larger and
// rotated, so every ring of the waveform flies outward and leaves a trail.
// Paints only with the cover's own colors (see albumColors), stepping through them
// on the beat rather than fading, since a fade between two colors passes through others.
function tunnel(): Scene {
  const buf = document.createElement("canvas")
  const bctx = buf.getContext("2d")!
  let w = 0
  let h = 0
  let lastTime = 0
  let colorIndex = 0
  let wasHit = false
  return {
    resize(nw, nh) {
      w = buf.width = nw
      h = buf.height = nh
    },
    draw(ctx, f, p) {
      const colors = coverColors(p)
      const hit = f.beat > 0.95
      if (hit && !wasHit) colorIndex = (colorIndex + 1) % colors.length
      wasHit = hit
      const colorAt = (offset: number) => colors[(colorIndex + offset) % colors.length]
      // Motion is per second, not per frame, so 144 Hz screens don't run it 2.4x faster.
      const steps = Math.min(3, Math.max(0, (f.time - lastTime) * 60))
      lastTime = f.time
      bctx.globalCompositeOperation = "copy"
      bctx.drawImage(ctx.canvas, 0, 0)

      ctx.globalCompositeOperation = "source-over"
      ctx.fillStyle = hsl(colors[0].h, Math.min(60, colors[0].s), 4)
      ctx.fillRect(0, 0, w, h)
      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.rotate(-(0.0012 + f.mid * 0.004) * steps) // negative is counterclockwise on a canvas
      // Slow drift outward; the beat gives a gentle push rather than a lurch.
      const z = Math.pow(1.004 + f.bass * 0.012 + f.beat * 0.008, steps)
      ctx.scale(z, z)
      ctx.translate(-w / 2, -h / 2)
      // Slower zoom → keep trails about as long on screen.
      ctx.globalAlpha = Math.pow(0.93, steps)
      ctx.drawImage(buf, 0, 0)
      ctx.restore()

      const cx = w / 2
      const cy = h / 2
      const base = Math.min(w, h) * (0.12 + f.bass * 0.07 + f.beat * 0.03)
      const n = f.wave.length
      // Plain source-over: additive blending would mix overlapping colors into new ones.
      for (let pass = 0; pass < 2; pass++) {
        ctx.beginPath()
        for (let i = 0; i <= n; i++) {
          const k = i % n
          const a = (k / n) * Math.PI * 2 - f.time * 0.08
          const r = base * (1 + f.wave[k] * (0.35 + f.level * 0.4)) * (pass ? 0.6 : 1)
          const x = cx + Math.cos(a) * r
          const y = cy + Math.sin(a) * r
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = paint(colorAt(pass), 0.9, f.treble * 10)
        ctx.lineWidth = 1.5 + f.beat * 4 + f.bass * 2
        ctx.stroke()
      }
      // Sparks on the ring for the highs.
      for (let i = 0; i < BINS; i += 3) {
        const v = f.spectrum[i]
        if (v < 0.45) continue
        const a = (i / BINS) * Math.PI * 2 - f.time * 0.12
        const r = base * (1.25 + v * 0.6)
        ctx.fillStyle = paint(colorAt(Math.floor((i / BINS) * colors.length)), v, 10)
        ctx.fillRect(cx + Math.cos(a) * r - 1.5, cy + Math.sin(a) * r - 1.5, 3, 3)
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Orbit: rings of dots around an empty center, seen from a shallow diagonal angle like
// the disc around a black hole. Near and far sides visibly run in opposite directions.

/**
 * How close the song is to its fullest, 0..1, from live audio: for songs that aren't
 * scanned (see songFullness), which is always a little late. True peaks have every band high at once,
 * bass included, and stay there; drums spike and leave gaps. So this averages all three
 * bands and takes the lowest level of the last moment, which a drum hit can't lift because
 * the gap after it sets the reading. It compares the result with the fullest the song has
 * held for a few seconds so far. That mark never fades during a song, so a long chorus
 * stays at full.
 * Until a song has shown its range, it's compared with a typical full mix instead, which
 * eases down for songs that never get that big. Silence (a new song) starts over.
 */
export function createFullnessMeter() {
  const TYPICAL_PEAK = 0.63
  const RANGE = 0.13 // this far below the song's fullest counts as nothing
  const FORGET_TYPICAL_SECONDS = 150
  const SILENCE = 0.1
  const SILENCE_SECONDS = 1
  const LOW_WINDOW_SECONDS = 0.1 // the lowest of this long and the one before it
  let lowNow = Infinity
  let lowBefore = Infinity
  let windowAge = 0
  let fullness = 0
  let sustained = 0
  let fullest = 0
  let played = 0
  let silent = SILENCE_SECONDS
  return (bass: number, mid: number, treble: number, dt: number) => {
    const level = (bass + mid + treble) / 3
    windowAge += dt
    if (windowAge >= LOW_WINDOW_SECONDS) {
      windowAge = 0
      lowBefore = lowNow
      lowNow = Infinity
    }
    lowNow = Math.min(lowNow, level)
    const input = Math.min(lowNow, lowBefore)
    if (input < SILENCE) {
      silent += dt
      if (silent >= SILENCE_SECONDS) sustained = fullest = played = 0
    } else {
      silent = 0
      played += dt
    }
    fullness += (input - fullness) * (1 - Math.exp(-dt * (input > fullness ? 20 : 8)))
    sustained += (fullness - sustained) * (1 - Math.exp(-dt / 5)) // a brief spike doesn't move the mark
    fullest = Math.max(fullest, sustained)
    const mark = fullest + Math.max(0, TYPICAL_PEAK - fullest) * Math.exp(-played / FORGET_TYPICAL_SECONDS)
    return Math.min(1, Math.max(0, (fullness - (mark - RANGE)) / RANGE))
  }
}
/** Reads the song's scan this far ahead of what you're hearing, cancelling the time the speed takes to change and draw. */
export const ORBIT_LEAD_SECONDS = 0.05
/** Full speed, before the song's tempo scales it. */
const ORBIT_TOP_SPEED = 4.5
const ORBIT_DRIFT_SPEED = 0.12
/** The speed a moment asks for: a slow drift until the song is near its fullest, scaled by its tempo. */
export function orbitSpeed(fullness: number, bpm: number | null) {
  const tempo = bpm ? Math.min(1.8, Math.max(0.6, bpm / 120)) : 1
  return (ORBIT_DRIFT_SPEED + (ORBIT_TOP_SPEED - ORBIT_DRIFT_SPEED) * Math.pow(fullness, 3)) * tempo
}
/**
 * The outer ring's radius. It's sized from the screen's short side, as if fitting a square:
 * a wide screen adds empty space around the rings, not bigger rings. They grow with speed
 * (`scale`), which on a wide screen stops where they'd leave it. A tall screen lets them
 * run off the sides at full speed.
 */
export function orbitRadius(w: number, h: number, reachX: number, reachY: number, scale = 1) {
  const radius = ((Math.min(w, h) * 0.5) / Math.max(reachX, reachY)) * scale
  return w > h ? Math.min(radius, (w * 0.5) / reachX, (h * 0.5) / reachY) : radius
}
/** The rings grow with speed, up to 1.5x at full speed. */
export const orbitScale = (speed: number) => 1 + 0.5 * Math.min(1, speed / ORBIT_TOP_SPEED)
/** Peak chaos and the white hole snap on and off within a few frames: the illusion only works if it's fast. */
export function chaseOrb(orb: number, target: number, dt: number) {
  const rate = target > orb ? 40 : 22
  return orb + (target - orb) * (1 - Math.exp(-rate * dt))
}
/**
 * Where gravitational lensing shows something that's really `distance` from the center:
 * nearby things are pushed out and bent around it, and it fades to no change far away.
 */
export const lensed = (distance: number, einsteinRadius: number) => (distance + Math.sqrt(distance * distance + 4 * einsteinRadius * einsteinRadius)) / 2
/** Moves toward the asked-for speed: leaps within a few frames, then falls back fairly quickly too. */
export function chaseSpeed(speed: number, target: number, dt: number) {
  const rate = target > speed ? 30 : 15
  return speed + (target - speed) * (1 - Math.exp(-rate * dt))
}

/** A white hole: a small, hard core with a tight, fast shimmer at its edge, and a little glow. */
function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, power: number, time: number) {
  const glow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 3)
  glow.addColorStop(0, "rgba(255, 255, 255, 0.45)")
  glow.addColorStop(0.4, "rgba(255, 255, 255, 0.08)")
  glow.addColorStop(1, "rgba(255, 255, 255, 0)")
  ctx.globalAlpha = power
  ctx.fillStyle = glow
  ctx.fillRect(x - radius * 3, y - radius * 3, radius * 6, radius * 6)
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2
    const edge = radius * (1 + 0.03 * (Math.sin(a * 3 + time * 7) + Math.sin(a * 5 - time * 11) * 0.6))
    if (i === 0) ctx.moveTo(x + Math.cos(a) * edge, y + Math.sin(a) * edge)
    else ctx.lineTo(x + Math.cos(a) * edge, y + Math.sin(a) * edge)
  }
  ctx.closePath()
  ctx.fill()
}

function orbit(): Scene {
  // Radius ranges (1 = the outer edge), with gaps between them so they read as separate
  // rings. Each ring has its own thickness and leans in its own plane.
  const BANDS = [
    { from: 0.34, to: 0.37, share: 0.05, thick: 0.03, lean: 0.1 },
    { from: 0.39, to: 0.46, share: 0.14, thick: 0.1, lean: -0.07 },
    { from: 0.48, to: 0.5, share: 0.04, thick: 0.03, lean: 0.16 },
    { from: 0.53, to: 0.63, share: 0.2, thick: 0.14, lean: 0.05 },
    { from: 0.66, to: 0.68, share: 0.05, thick: 0.04, lean: -0.15 },
    { from: 0.71, to: 0.84, share: 0.28, thick: 0.18, lean: -0.05 },
    { from: 0.87, to: 0.89, share: 0.05, thick: 0.04, lean: 0.13 },
    { from: 0.92, to: 0.96, share: 0.12, thick: 0.1, lean: 0.08 },
    { from: 0.98, to: 1, share: 0.07, thick: 0.05, lean: -0.11 },
  ]
  const DOTS = 4000
  const STRAY_SHARE = 0.06 // dots on wild orbits that cut across the rings
  const ANGULAR_SPEED = 0.35 // at the outer edge, per unit of speed
  const ORB_LAYER = 2
  const PEAK_EXTRA_SPEED = 0.5
  const PEAK_EXTRA_WILD = 2.2
  const PEAK_SHAKE = 0.035
  const STREAK_SECONDS = 0.03 // each dot is drawn as the path it just covered, so direction and speed read
  const CAMERA = 7 // enough perspective to feel deep, without making the ellipse lopsided
  // Far to near: drawn back to front, in batches because thousands of separate color changes are slow.
  const LAYER_ALPHA = [0.35, 0.5, 0.68, 0.85, 1]
  const LAYER_WIDTH = [0.7, 0.9, 1.1, 1.4, 1.8]

  const spread = () => Math.random() + Math.random() - 1 // -1..1, bunched toward the middle
  const radius = new Float32Array(DOTS)
  const start = new Float32Array(DOTS)
  const height = new Float32Array(DOTS)
  const pace = new Float32Array(DOTS) // each dot's own speed, so the rings shear and clump
  const ecc = new Float32Array(DOTS) // how oval the dot's own orbit is
  const eccPhase = new Float32Array(DOTS)
  const incline = new Float32Array(DOTS) // how far the dot's own orbit tips out of its ring
  const inclinePhase = new Float32Array(DOTS)
  const bandEnd: number[] = []
  let filled = 0
  BANDS.forEach((band, b) => {
    const end = b === BANDS.length - 1 ? DOTS : filled + Math.round(band.share * DOTS)
    for (; filled < end; filled++) {
      const stray = Math.random() < STRAY_SHARE
      radius[filled] = band.from + Math.random() * (band.to - band.from)
      start[filled] = Math.random() * Math.PI * 2
      height[filled] = spread() * band.thick
      pace[filled] = 0.85 + Math.random() * 0.3
      ecc[filled] = Math.random() * (stray ? 0.45 : 0.035)
      eccPhase[filled] = Math.random() * Math.PI * 2
      incline[filled] = Math.random() * (stray ? 0.7 : 0.07)
      inclinePhase[filled] = Math.random() * Math.PI * 2
    }
    bandEnd.push(end)
  })
  const headX = new Float32Array(DOTS)
  const headY = new Float32Array(DOTS)
  const tailX = new Float32Array(DOTS)
  const tailY = new Float32Array(DOTS)
  const layer = new Uint8Array(DOTS)

  let w = 0
  let h = 0
  let lastTime = 0
  let speed = orbitSpeed(0, null)
  let travel = 0 // how far the rings have turned, so changing speed never makes dots jump
  let orb = 0 // peak chaos and the white hole, 0..1
  const meter = createFullnessMeter()
  return {
    resize(nw, nh) {
      w = nw
      h = nh
    },
    draw(ctx, f, p) {
      const colors = coverColors(p)
      const dt = Math.min(0.1, Math.max(0, f.time - lastTime))
      lastTime = f.time
      const live = meter(f.bass, f.mid, f.treble, dt) // keeps learning, in case there's no scan
      const scanned = f.songId && f.position !== null ? songFullness(f.songId, f.position + ORBIT_LEAD_SECONDS) : null
      // The song's most intense moments, known from its scan: peak chaos, and the only time the white hole shows.
      const atPeak = f.songId !== null && f.position !== null && songPeak(f.songId, f.position + ORBIT_LEAD_SECONDS)
      orb = chaseOrb(orb, atPeak ? 1 : 0, dt)
      speed = chaseSpeed(speed, orbitSpeed(scanned ?? live, f.bpm) * (1 + orb * PEAK_EXTRA_SPEED), dt)
      travel += speed * dt
      const energy = Math.min(1, speed / ORBIT_TOP_SPEED) // the harder it's going, the wilder the orbits

      // The axis traces a slow circle, about once a minute: the rings tilt more and less and lean
      // side to side, but stay diagonal and never flip over. Independent of the music.
      const axis = f.time * 0.1
      const tilt = 0.46 + Math.cos(axis) * 0.2
      const roll = -0.42 + Math.sin(axis) * 0.35
      const cosT = Math.cos(tilt)
      const sinT = Math.sin(tilt)
      const cosR = Math.cos(roll)
      const sinR = Math.sin(roll)
      // Fit the ellipse at its current angle.
      const reachX = Math.hypot(cosR, sinT * sinR)
      const reachY = Math.hypot(sinR, sinT * cosR)
      const outer = orbitRadius(w, h, reachX, reachY, orbitScale(speed))
      const cx = w / 2
      const cy = h / 2
      const pixel = Math.max(1.2, Math.min(w, h) / 500)
      // Capped at full speed's length: longer ones cost far more to draw, and peak chaos doesn't need them.
      const streak = Math.max(0.004, Math.min(speed, ORBIT_TOP_SPEED) * ANGULAR_SPEED * STREAK_SECONDS)
      const wild = 1 + energy * 0.9 + orb * PEAK_EXTRA_WILD
      const shake = orb * PEAK_SHAKE
      const lens = orb * outer * 0.17 // how far the white hole bends the dots around it
      let from = 0
      bandEnd.forEach((end, b) => {
        // Each ring's plane sways on its own, so the rings drift through each other.
        const lean = BANDS[b].lean * Math.sin(f.time * 0.13 + b * 1.7) * wild
        for (let i = from; i < end; i++) {
          const a = start[i] + (travel * ANGULAR_SPEED * pace[i]) / radius[i] // inner rings go faster, as in a real orbit
          for (let tip = 0; tip < 2; tip++) {
            const angle = tip ? a : a - streak / radius[i]
            // At a peak, every dot also shudders in and out on its own rhythm.
            const r = radius[i] * (1 + ecc[i] * wild * Math.cos(angle + eccPhase[i]) + shake * Math.sin(f.time * 31 + eccPhase[i] * 7))
            const x = Math.cos(angle) * r
            const flat = Math.sin(angle) * r
            const ht = height[i] + flat * lean + r * incline[i] * wild * Math.sin(angle + inclinePhase[i])
            // Viewed from above: the near side of the rings is the bottom of the ellipse.
            const y = ht * cosT + flat * sinT
            const depth = flat * cosT - ht * sinT
            const scale = (outer * CAMERA) / (CAMERA - depth)
            let sx = (x * cosR - y * sinR) * scale
            let sy = (x * sinR + y * cosR) * scale
            if (lens > 0.5) {
              const distance = Math.hypot(sx, sy) || 1
              const push = lensed(distance, lens) / distance
              sx *= push
              sy *= push
            }
            sx += cx
            sy += cy
            if (tip) {
              headX[i] = sx
              headY[i] = sy
              layer[i] = Math.max(0, Math.min(LAYER_ALPHA.length - 1, Math.floor(((depth + 1) / 2) * LAYER_ALPHA.length)))
            } else {
              tailX[i] = sx
              tailY[i] = sy
            }
          }
        }
        from = end
      })

      const thinOut = orb > 0.5
      ctx.globalCompositeOperation = "source-over"
      ctx.globalAlpha = 1
      ctx.fillStyle = "#000"
      ctx.fillRect(0, 0, w, h)
      for (let l = 0; l < LAYER_ALPHA.length; l++) {
        ctx.globalAlpha = LAYER_ALPHA[l]
        ctx.lineWidth = LAYER_WIDTH[l] * pixel
        from = 0
        bandEnd.forEach((end, b) => {
          // Rings also differ in brightness, so a cover with one color still shows the rings apart.
          ctx.strokeStyle = paint(colors[b % colors.length], 1, (b % 3) * 7 + energy * 6)
          ctx.beginPath()
          for (let i = from; i < end; i++) {
            if (layer[i] !== l) continue
            if (thinOut && i % 4 === 0) continue // nobody can count dots in peak chaos, and it's the most costly moment to draw
            ctx.moveTo(tailX[i], tailY[i])
            ctx.lineTo(headX[i], headY[i])
          }
          ctx.stroke()
          from = end
        })
        // The white hole sits at the center of the rings: behind their near side, in front of the far side.
        if (l === ORB_LAYER && orb > 0.01) drawOrb(ctx, cx, cy, Math.min(w, h) * 0.035 * Math.sqrt(orb), orb, f.time)
      }
      ctx.globalAlpha = 1
    },
  }
}

// ---------------------------------------------------------------------------
// Shared helpers for the calm scenes.

/** Seconds since the previous draw, from the frame clock (frame-rate independent). */
function clock() {
  let last: number | null = null
  return (f: AudioFrame) => {
    const dt = last === null ? 0 : Math.min(0.1, Math.max(0, f.time - last))
    last = f.time
    return dt
  }
}

/** Smooth 2D value noise in roughly -1..1. */
function noise2(x: number, y: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const hash = (a: number, b: number) => {
    let n = (a * 374761393 + b * 668265263) | 0
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) & 0xffff) / 0x7fff - 1
  }
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const top = hash(xi, yi) + (hash(xi + 1, yi) - hash(xi, yi)) * u
  const bottom = hash(xi, yi + 1) + (hash(xi + 1, yi + 1) - hash(xi, yi + 1)) * u
  return top + (bottom - top) * v
}

/** Pull hue `a` toward `b` by `t` along the shorter way round. */
const towardHue = (a: number, b: number, t: number) => (a + ((((b - a + 540) % 360) - 180) * t) + 360) % 360

// ---------------------------------------------------------------------------
// Nighttime: gliding low over an endless field of ice at night. Distant mountains,
// the northern lights overhead, snow drifting past. The music changes things
// slowly: loudness eases your speed and the aurora's glow.
function nighttime(): Scene {
  let w = 0
  let h = 0
  const dtOf = clock()
  let travel = 0
  let speed = 0.5
  let glow = 0
  const SPACING = 0.5 // world distance between ice ridges
  const Z_NEAR = 0.6
  const Z_FAR = 28
  const CAM = 1 // camera height above the ice
  const SNOW = 220
  const sx = new Float32Array(SNOW)
  const sy = new Float32Array(SNOW)
  const sz = new Float32Array(SNOW)
  const placeFlake = (i: number, anywhere: boolean) => {
    sz[i] = anywhere ? Z_NEAR + Math.random() * (Z_FAR - Z_NEAR) : Z_FAR * (0.6 + Math.random() * 0.4)
    sx[i] = (Math.random() - 0.5) * sz[i] * 2.4
    sy[i] = -0.2 + Math.random() * 1.1 // below eye level: flakes over the ice, never dots in the sky
  }
  for (let i = 0; i < SNOW; i++) placeFlake(i, true)
  const ground = (x: number, z: number) => noise2(x * 0.32, z * 0.32) * 0.32 + noise2(x * 1.1 + 40, z * 1.1) * 0.07

  return {
    resize(nw, nh) {
      w = nw
      h = nh
    },
    draw(ctx, f, p) {
      const dt = dtOf(f)
      // Ease toward the song's energy over a few seconds: never lurches.
      speed += (0.45 + f.level * 1.1 - speed) * Math.min(1, dt * 0.5)
      glow += (f.mid * 0.7 + f.treble * 0.3 - glow) * Math.min(1, dt * 0.8)
      travel += speed * dt
      // Icy blue, leaning a little toward the album's color.
      const ice = towardHue(200, p.h, 0.15)
      const horizon = h * 0.44
      const focal = h * 0.55
      ctx.globalCompositeOperation = "source-over"
      ctx.globalAlpha = 1

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, horizon)
      sky.addColorStop(0, hsl(ice + 15, 50, 3))
      sky.addColorStop(1, hsl(ice, 40, 13))
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, w, horizon + 2)
      // Aurora: a few curtains, drawn as thin vertical strips of one gradient each.
      ctx.globalCompositeOperation = "lighter"
      for (let c = 0; c < 3; c++) {
        const g = ctx.createLinearGradient(0, 0, 0, 1)
        const hue = (ice - 60 + c * 25 + 360) % 360 // teal-green through cyan
        g.addColorStop(0, hsl(hue, 85, 60, 0))
        g.addColorStop(0.25, hsl(hue, 85, 62, 1))
        g.addColorStop(1, hsl(hue + 20, 80, 50, 0))
        ctx.fillStyle = g
        // Whole-pixel strips that just touch: overlapping ones would show as seams.
        const STRIP = 4
        for (let x = 0; x < w; x += STRIP) {
          const ph = x * 0.0035 + f.time * (0.035 + c * 0.012) + c * 2.1
          const top = h * (0.06 + c * 0.05) + Math.sin(ph) * h * 0.04 + Math.sin(ph * 2.3 + f.time * 0.05) * h * 0.018
          const len = h * (0.13 + 0.06 * Math.sin(ph * 1.7 + c))
          const a = (0.04 + glow * 0.09) * Math.max(0, 0.35 + 0.65 * Math.sin(ph * 2.9 + f.time * 0.12 + c))
          if (a < 0.003) continue
          ctx.globalAlpha = a
          ctx.setTransform(STRIP, 0, 0, len, x, Math.round(top))
          ctx.fillRect(0, 0, 1, 1)
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = "source-over"

      // Mountains: two silhouettes, barely moving (they're far away).
      for (let layer = 0; layer < 2; layer++) {
        const drift = travel * (0.004 + layer * 0.006)
        ctx.beginPath()
        ctx.moveTo(0, horizon + 1)
        for (let x = 0; x <= w; x += 8) {
          const u = x / w
          const peak = Math.abs(noise2(u * (3 + layer * 2) + drift + layer * 17, layer * 5)) * (0.09 - layer * 0.03) + noise2(u * 14 + layer * 3, 2) * 0.01
          ctx.lineTo(x, horizon - peak * h)
        }
        ctx.lineTo(w, horizon + 1)
        ctx.closePath()
        ctx.fillStyle = hsl(ice, 30, layer ? 11 : 8)
        ctx.fill()
        ctx.strokeStyle = hsl(ice, 45, 75, layer ? 0.12 : 0.07) // moonlit snow on the ridges
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Ice field: ridges from far to near; each row fills down to the bottom to hide the rows behind it.
      const COLS = 64
      const first = Math.ceil((travel + Z_NEAR) / SPACING)
      const last = Math.floor((travel + Z_FAR) / SPACING)
      const fogColor = (fog: number) => hsl(ice, 35 - fog * 10, 6 + fog * 7)
      // Distant ice between the horizon and the farthest ridge (otherwise that strip is never repainted).
      ctx.fillStyle = fogColor(1)
      ctx.fillRect(0, horizon, w, h - horizon)
      for (let k = last; k >= first; k--) {
        const zw = k * SPACING
        const z = zw - travel
        const fog = Math.min(1, z / Z_FAR)
        ctx.beginPath()
        for (let c = 0; c <= COLS; c++) {
          const sxp = (c / COLS) * w
          const xw = ((sxp - w / 2) * z) / focal
          const y = horizon + ((CAM - ground(xw, zw)) / z) * focal
          if (c === 0) ctx.moveTo(sxp, y)
          else ctx.lineTo(sxp, y)
        }
        ctx.lineTo(w, h)
        ctx.lineTo(0, h)
        ctx.closePath()
        ctx.fillStyle = fogColor(fog)
        ctx.fill()
        // Fade rows in at the far end so they don't pop into view.
        const appear = Math.min(1, (Z_FAR - z) / 3)
        ctx.strokeStyle = hsl(ice, 55, 78, (0.05 + 0.3 * (1 - fog)) * appear)
        ctx.lineWidth = 1
        ctx.stroke()
      }

      ctx.globalCompositeOperation = "lighter"
      // Snow drifting past as you glide.
      for (let i = 0; i < SNOW; i++) {
        sz[i] -= speed * dt * 0.9
        sy[i] -= dt * 0.12
        sx[i] += Math.sin(f.time * 0.4 + i) * dt * 0.05
        if (sz[i] < Z_NEAR || sy[i] < -0.4) placeFlake(i, false)
        const px = w / 2 + (sx[i] / sz[i]) * focal
        const py = horizon + ((CAM - sy[i]) / sz[i]) * focal
        if (px < 0 || px > w || py < 0 || py > h) continue
        const near = 1 - sz[i] / Z_FAR
        const size = 0.6 + near * 2.4
        ctx.fillStyle = hsl(ice, 25, 92, 0.1 + near * 0.45)
        ctx.fillRect(px, py, size, size)
      }
      ctx.globalCompositeOperation = "source-over"
    },
  }
}

// ---------------------------------------------------------------------------
// Drift: big, soft, out-of-focus glows in the colors of the cover art, flowing
// around the screen. Calm on purpose: it ignores individual beats and only
// moves a little livelier (and glows a little brighter) when the song is fuller,
// smoothed over a couple of seconds. Nothing flashes or jumps.
function drift(): Scene {
  let w = 0
  let h = 0
  const dtOf = clock()
  let breath = 0
  let phase = 0 // our own clock: runs faster when the music is fuller
  const blobs = Array.from({ length: 5 }, (_, i) => ({
    ax: 0.28 + Math.random() * 0.2,
    ay: 0.22 + Math.random() * 0.18,
    fx: 0.07 + Math.random() * 0.07,
    fy: 0.05 + Math.random() * 0.07,
    ph: Math.random() * Math.PI * 2,
    r: 0.26 + Math.random() * 0.16,
    slot: i,
    color: null as Hsl | null,
  }))
  /** The cover's colors, or a harmony around the base color when there's no art. */
  const colorsFor = (p: Palette): Hsl[] =>
    p.swatches.length ? p.swatches : [0, 35, -35, 70].map((d) => ({ h: (p.h + d + 360) % 360, s: Math.min(70, p.s), l: 50 }))
  return {
    resize(nw, nh) {
      w = nw
      h = nh
    },
    draw(ctx, f, p) {
      const dt = dtOf(f)
      breath += (f.level - breath) * Math.min(1, dt * 0.5) // ~2 s to follow the song
      phase += dt * (1 + breath * 0.9)
      const colors = colorsFor(p)
      // Background: the darkest cover color, nearly black.
      const darkest = colors.reduce((a, c) => (c.l < a.l ? c : a), colors[0])
      ctx.globalCompositeOperation = "source-over"
      ctx.fillStyle = hsl(darkest.h, Math.min(40, darkest.s * 0.6), 5)
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = "screen" // overlapping colors stay clean instead of going muddy
      const m = Math.min(w, h)
      const swirl = phase * 0.03 // the whole field slowly turns
      const ease = Math.min(1, dt * 0.35) // colors glide over ~3 s when the song changes
      for (const b of blobs) {
        const want = colors[b.slot % colors.length]
        if (!b.color) b.color = { ...want }
        else {
          b.color.h = towardHue(b.color.h, want.h, ease)
          b.color.s += (want.s - b.color.s) * ease
          b.color.l += (want.l - b.color.l) * ease
        }
        const ox = Math.sin(phase * b.fx + b.ph) * w * b.ax + noise2(phase * 0.05, b.ph) * w * 0.08
        const oy = Math.cos(phase * b.fy + b.ph * 1.3) * h * b.ay + noise2(b.ph, phase * 0.05) * h * 0.08
        const x = w / 2 + ox * Math.cos(swirl) - oy * Math.sin(swirl)
        const y = h / 2 + ox * Math.sin(swirl) + oy * Math.cos(swirl)
        const r = m * b.r * (1 + breath * 0.25 + Math.sin(phase * 0.2 + b.ph) * 0.08)
        // Keep the cover's hue and saturation; pull lightness into a range that glows.
        const l = Math.max(45, Math.min(62, b.color.l))
        const sat = b.color.s > 22 ? Math.max(b.color.s, 65) : b.color.s // vivid covers stay vivid; grey ones stay grey
        const a = 0.34 + breath * 0.12
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, hsl(b.color.h, sat, l, a))
        g.addColorStop(0.45, hsl(b.color.h, sat, l * 0.9, a * 0.5))
        g.addColorStop(1, hsl(b.color.h, sat, l * 0.8, 0))
        ctx.fillStyle = g
        ctx.fillRect(x - r, y - r, r * 2, r * 2)
      }
      ctx.globalCompositeOperation = "source-over"
    },
  }
}

export function createScene(id: SceneId): Scene {
  switch (id) {
    case "tunnel":
      return tunnel()
    case "orbit":
      return orbit()
    case "nighttime":
      return nighttime()
    case "drift":
      return drift()
  }
}
