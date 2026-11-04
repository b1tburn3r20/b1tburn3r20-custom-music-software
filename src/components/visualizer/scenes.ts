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

export type SceneId = "tunnel" | "orbit" | "nebula" | "tundra" | "nighttime" | "drift"
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
  { id: "nebula", label: "Nebula", description: "Clouds of sparks that burst on the beat and drift on currents.", calm: false },
  { id: "tundra", label: "Tundra", description: "Racing high over spiky polygon ice and mountains that rise to meet you. Faster with faster songs.", calm: false },
  { id: "nighttime", label: "Nighttime", description: "Gliding over moonlit ice under the northern lights. The music sets the pace.", calm: true },
  { id: "drift", label: "Drift", description: "Soft glows in the colors of the cover art, flowing gently with the song.", calm: true },
]

const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h % 360}, ${s}%, ${l}%, ${a})`
const bg = (p: Palette, a = 1) => hsl(p.h, Math.min(60, p.s), 4, a)

/** Hue that wanders around the album color so long songs don't look static. */
const hueAt = (p: Palette, f: AudioFrame, offset = 0) => (p.h + Math.sin(f.time * 0.07) * 35 + offset + 360) % 360

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
      const outer = Math.min((w * 0.5) / reachX, (h * 0.5) / reachY) * orbitScale(speed)
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
// Nebula: particles born at the center, pushed out by the bass and carried by a
// slowly turning flow field.
function nebula(): Scene {
  const MAX = 2400
  const px = new Float32Array(MAX)
  const py = new Float32Array(MAX)
  const vx = new Float32Array(MAX)
  const vy = new Float32Array(MAX)
  const life = new Float32Array(MAX)
  const hue = new Float32Array(MAX)
  let next = 0
  let w = 0
  let h = 0
  let scale = 1
  const spawn = (f: AudioFrame, p: Palette, burst: boolean) => {
    const i = next
    next = (next + 1) % MAX
    const a = Math.random() * Math.PI * 2
    const speed = (burst ? 3 + Math.random() * 9 : 0.5 + Math.random() * 2) * (1 + f.bass * 2) * scale
    const r = Math.random() * 20 * scale
    px[i] = w / 2 + Math.cos(a) * r
    py[i] = h / 2 + Math.sin(a) * r
    vx[i] = Math.cos(a) * speed
    vy[i] = Math.sin(a) * speed
    life[i] = 1
    hue[i] = hueAt(p, f, (Math.random() - 0.5) * 70 + (burst ? 30 : 0))
  }
  return {
    resize(nw, nh) {
      w = nw
      h = nh
      scale = Math.min(w, h) / 900
      life.fill(0)
    },
    draw(ctx, f, p) {
      ctx.globalCompositeOperation = "source-over"
      ctx.fillStyle = bg(p, 0.18)
      ctx.fillRect(0, 0, w, h)
      const steady = Math.floor(2 + f.level * 22)
      for (let i = 0; i < steady; i++) spawn(f, p, false)
      if (f.beat > 0.95) for (let i = 0; i < 160 + f.bass * 200; i++) spawn(f, p, true)

      ctx.globalCompositeOperation = "lighter"
      const t = f.time * 0.25
      const field = 0.0025 / scale
      const push = 0.08 + f.mid * 0.25
      const size = (1.2 + f.treble * 2.5) * Math.max(1, scale)
      for (let i = 0; i < MAX; i++) {
        if (life[i] <= 0) continue
        const a = Math.sin(px[i] * field + t) * Math.cos(py[i] * field - t * 0.8) * Math.PI * 2
        vx[i] = vx[i] * 0.975 + Math.cos(a) * push
        vy[i] = vy[i] * 0.975 + Math.sin(a) * push
        px[i] += vx[i]
        py[i] += vy[i]
        life[i] -= 0.004 + (1 - f.level) * 0.004
        if (px[i] < -20 || px[i] > w + 20 || py[i] < -20 || py[i] > h + 20) life[i] = 0
        const l = life[i]
        ctx.fillStyle = hsl(hue[i], 85, 45 + l * 25, l * 0.8)
        const s = size * (0.5 + l)
        ctx.fillRect(px[i] - s / 2, py[i] - s / 2, s, s)
      }
      // Soft core glow that breathes with the bass.
      const r = Math.min(w, h) * (0.08 + f.bass * 0.12 + f.beat * 0.05)
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r)
      g.addColorStop(0, hsl(hueAt(p, f), 80, 60, 0.25 + f.bass * 0.3))
      g.addColorStop(1, hsl(hueAt(p, f), 80, 40, 0))
      ctx.fillStyle = g
      ctx.fillRect(w / 2 - r, h / 2 - r, r * 2, r * 2)
      ctx.globalCompositeOperation = "source-over"
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

// ---------------------------------------------------------------------------
// Terrain level-of-detail with geomorphing (used by Tundra; exported for tests).

const mod = (a: number, m: number) => ((a % m) + m) % m

/**
 * Height of grid vertex (j, k) as drawn in a mesh whose cells are `step` vertices
 * wide. Within `morph` world units before the boundary to the next, twice-as-coarse
 * level (`toBoundary` = distance left), vertices the coarser mesh doesn't have
 * glide onto the coarser surface, so switching levels never pops and the two
 * meshes meet without cracks. `toBoundary` null = no coarser level.
 *
 * The coarse mesh splits cell (jc..jc+S, kc..kc+S) along the diagonal from
 * near-left to far-right when ((jc + S) / S + kc / S) is odd, otherwise along the
 * other diagonal (cells are numbered by their right-hand column).
 */
export function lodHeight(vh: (j: number, k: number) => number, j: number, k: number, step: number, toBoundary: number | null, morph: number): number {
  const y = vh(j, k)
  if (toBoundary === null) return y
  const s = step
  const S = s * 2
  const jm = mod(j, S)
  const km = mod(k, S)
  if (!jm && !km) return y // also a vertex of the coarser mesh
  const t = Math.min(1, Math.max(0, 1 - toBoundary / morph))
  if (t <= 0) return y
  let target: number
  if (!km) target = (vh(j - s, k) + vh(j + s, k)) / 2
  else if (!jm) target = (vh(j, k - s) + vh(j, k + s)) / 2
  else {
    const jc = j - s
    const kc = k - s
    const odd = ((jc + S) / S + kc / S) & 1
    target = odd ? (vh(jc, kc) + vh(jc + S, kc + S)) / 2 : (vh(jc, kc + S) + vh(jc + S, kc)) / 2
  }
  const e = t * t * (3 - 2 * t)
  return y + (target - y) * e
}

// ---------------------------------------------------------------------------
// Tundra: low-poly arctic, seen from high up. Racing over a deep, spiky, faceted
// ice landscape: wide valleys, sharp ice spikes in the ground itself, and now and
// then a mountain range that rises up to meet you (the camera climbs to clear it).
// Everything is flat-shaded triangles, no curves. Fast by default, faster with
// faster tempos, with a surge forward on every beat.
type V3 = [number, number, number]
function tundra(): Scene {
  let w = 0
  let h = 0
  const dtOf = clock()
  let travel = 0
  let speed = 20
  let surge = 0
  let camY = 16
  const CELL = 1.6 // terrain triangle size near you (world units)
  // Distant terrain uses bigger cells (the detail is lost in the haze anyway). Each
  // level's cells are twice the size of the previous one, out to `until`.
  const LODS = [
    { step: 1, until: 45 },
    { step: 2, until: 95 },
    { step: 4, until: 150 },
    { step: 8, until: 215 },
    { step: 16, until: 480 },
  ]
  /** Before a level boundary, extra vertices glide onto the coarser shape over this distance, so nothing pops. */
  const MORPH = 16
  const Z_NEAR = 1.2
  const Z_FAR = LODS[LODS.length - 1].until
  // Fog thickens with distance and is total from FOG_END on, well before the far
  // edge, so new terrain is born invisible inside the haze and slowly emerges.
  const FOG_DEPTH = 85 // how quickly the haze thickens (exponential fog)
  const FOG_END = 400
  const FOG_NORM = 1 - Math.exp(-FOG_END / FOG_DEPTH)
  // High up, the ground seems to move slower, so these are gentler than when flying low.
  const CRUISE = 8 // base speed (world units / s)
  const PER_BPM = 0.1 // extra speed per beat-per-minute (120 bpm ≈ 2.5x the base speed)
  const MIN_ALT = 14 // how high we fly over the plains
  const CLEARANCE = 3 // how close the highest possible spike may come under us
  const PEAK = 7.2 // most a vertex rises above `land` (jitter + ice spike), see `vh`
  const CLIMB = 0.4 // steepest climb (height gained per unit travelled)
  const LOOKAHEAD = 150 // how far ahead the camera plans its climbs
  const NEAR = 8 // terrain this close must already be fully cleared
  const GRID = 4 // spacing of the terrain samples the camera looks at
  /** Height of the haze band above the horizon: hides where the farthest (fully fogged) terrain could rise. */
  const BAND = 0.05
  const SUN = normalize([0.35, 0.55, 0.76]) // low, ahead and to the right
  const HAZE = { h: 198, s: 45, l: 93 }

  function normalize(v: V3): V3 {
    const n = Math.hypot(v[0], v[1], v[2]) || 1
    return [v[0] / n, v[1] / n, v[2] / n]
  }
  const hash = (a: number, b: number) => {
    let n = (a * 374761393 + b * 668265263) | 0
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) & 0xffff) / 0xffff
  }
  /** Smooth landscape: rolling valleys plus sharp ridged mountain ranges that sometimes rise very high. */
  const land = (x: number, z: number) => {
    const valleys = noise2(x * 0.025, z * 0.025) * 7
    const ridge = 1 - Math.abs(noise2(x * 0.014 + 5, z * 0.014 - 3))
    const range = Math.pow(ridge, 5) * 26 * (0.6 + 0.4 * noise2(x * 0.006, z * 0.006 + 40))
    const crags = Math.pow(1 - Math.abs(noise2(x * 0.11, z * 0.11)), 2) * 2.2
    return valleys + range + crags
  }
  /**
   * Height at a terrain vertex: the landscape plus spiky jitter. Every few vertices
   * shoot up into a sharp ice spike. Spikes only sit on even vertices so they
   * survive the coarser distant mesh instead of popping in.
   */
  const vh = (j: number, k: number) => {
    const x = j * CELL
    const z = k * CELL
    let y = land(x, z) + (hash(j, k) - 0.5) * 1.4
    if (!(j & 1) && !(k & 1) && hash(k, j) > 0.86) y += 2 + hash(j + 7, k) * 4.5
    return y
  }
  /** How directly a face with normal `n` faces the sun, 0..1. */
  const lightOf = (n: V3) => Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2])
  /** Ice color for light level `lit` at depth `z`, fading into the haze with distance. */
  const shade = (lit: number, z: number) => {
    const fog = Math.min(1, (1 - Math.exp(-Math.max(0, z) / FOG_DEPTH)) / FOG_NORM)
    const l = 58 + lit * (99 - 58)
    // Mid-distance ice is greyer than the haze; at full fog it matches the haze exactly.
    const s = 50 * (1 - fog * 0.6) + (HAZE.s - 20) * Math.pow(fog, 6)
    return hsl(207 + (HAZE.h - 207) * fog, s, l + (HAZE.l - l) * fog)
  }
  const faceNormal = (a: V3, b: V3, c: V3): V3 => {
    const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const v: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const n = normalize([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]])
    return n[1] < 0 ? [-n[0], -n[1], -n[2]] : n // ground always faces up, whatever the winding
  }

  const WIND = 90
  const wx = new Float32Array(WIND)
  const wy = new Float32Array(WIND) // height relative to the camera
  const wz = new Float32Array(WIND)
  const placeWind = (i: number, anywhere: boolean) => {
    wz[i] = anywhere ? Z_NEAR + Math.random() * 30 : 15 + Math.random() * 15
    wx[i] = (Math.random() - 0.5) * wz[i] * 1.6
    wy[i] = (Math.random() - 0.5) * wz[i] * 0.8
  }
  for (let i = 0; i < WIND; i++) placeWind(i, true)

  return {
    resize(nw, nh) {
      w = nw
      h = nh
    },
    draw(ctx, f) {
      const dt = dtOf(f)
      // Until the tempo locks, loudness stands in for it (quiet ≈ 60 bpm, loud ≈ 140).
      const tempo = f.bpm ?? 60 + f.level * 80
      const cruise = CRUISE + tempo * PER_BPM
      if (f.beat > 0.95) surge = 1
      surge *= Math.pow(0.04, dt) // fades over about one beat
      speed += (cruise * (0.8 + surge * 0.45) - speed) * Math.min(1, dt * 5)
      travel += speed * dt

      // Altitude: cruise high; climb early and steadily for mountains far ahead, so
      // we're above every spike long before reaching it. Each terrain sample asks for
      // its height (plus margin) by the time we get within NEAR of it, climbing at
      // most CLIMB per unit travelled. Samples sit on a grid fixed to the world, so a
      // peak is tracked the whole way in, never discovered late. `plan` (with extra
      // clearance) is followed smoothly; `floor` is a hard limit that only matters if
      // the follow ever lags too far behind.
      let plan = MIN_ALT
      let floor = MIN_ALT
      for (let gz = Math.ceil(travel / GRID) * GRID; gz <= travel + LOOKAHEAD; gz += GRID) {
        const dz = gz - travel
        const half = 4 + Math.min(dz, 30) * 1.5 // the view's half-width there, with a margin
        let top = -Infinity
        for (let gx = -Math.ceil(half / GRID) * GRID; gx <= half + GRID; gx += GRID) top = Math.max(top, land(gx, gz))
        const need = top + PEAK - Math.max(0, dz - NEAR) * CLIMB
        plan = Math.max(plan, need + CLEARANCE)
        if (dz <= 12) floor = Math.max(floor, need + 0.5)
      }
      camY += (plan - camY) * Math.min(1, dt * (plan > camY ? 8 : 0.5))
      camY = Math.max(camY, floor)

      const horizon = h * 0.36 + Math.sin(f.time * 0.31) * h * 0.008
      const focal = h * 0.62
      const bank = Math.sin(f.time * 0.23) * 0.04 + Math.sin(f.time * 0.11 + 1) * 0.02
      const x0 = -w * 0.2
      const x1 = w * 1.2
      const project = (p: V3): [number, number] => {
        const z = p[2] - travel
        return [w / 2 + (p[0] / z) * focal, horizon + ((camY - p[1]) / z) * focal]
      }

      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.rotate(bank)
      ctx.translate(-w / 2, -h / 2)
      ctx.globalCompositeOperation = "source-over"
      ctx.globalAlpha = 1
      ctx.lineWidth = 1
      ctx.lineCap = "butt"

      // Sky
      const sky = ctx.createLinearGradient(0, -h * 0.2, 0, horizon)
      sky.addColorStop(0, hsl(212, 70, 56))
      sky.addColorStop(0.7, hsl(203, 70, 80))
      sky.addColorStop(1, hsl(HAZE.h, HAZE.s, HAZE.l))
      ctx.fillStyle = sky
      ctx.fillRect(x0, -h * 0.2, x1 - x0, horizon + h * 0.2 + 2)
      // Sun: nested hexagons, no curves.
      const sunX = w * 0.68
      const sunY = horizon - h * 0.12
      for (const [r, a] of [[h * 0.16, 0.18], [h * 0.09, 0.35], [h * 0.045, 1]] as const) {
        ctx.beginPath()
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + Math.PI / 6
          ctx.lineTo(sunX + Math.cos(ang) * r, sunY + Math.sin(ang) * r)
        }
        ctx.closePath()
        ctx.fillStyle = hsl(48, 100, 94, a)
        ctx.fill()
      }

      // Mountains: a zigzag of summits and valleys. Each summit is two flat facets
      // meeting at a ridge, the sunward one lit and the other in shadow.
      for (let layer = 0; layer < 2; layer++) {
        const drift = travel * (0.002 + layer * 0.004)
        const step = w / (7 + layer * 4)
        // Scroll continuously: summits that slide out on one side keep their shape (seeded by index).
        const scroll = drift * step
        const firstSummit = Math.floor(scroll / (step * 2))
        const shift = scroll - firstSummit * step * 2
        const fade = layer ? 0.12 : 0.35 // the far range is hazier
        const lit = hsl(210, 22, 97 + (HAZE.l - 97) * fade)
        const dark = hsl(212, 28, (layer ? 78 : 83) + (HAZE.l - (layer ? 78 : 83)) * fade)
        const base = horizon + h * 0.2 // reaches below the horizon: covers the gap before the nearest terrain
        for (let i = -2, x = x0 - step * 2 - shift; x <= x1 + step * 2; x += step * 2, i++) {
          const seed = i + firstSummit + layer * 101
          const peakX = x + step + (hash(seed, 1) - 0.5) * step * 0.6
          const peakY = horizon - h * ((layer ? 0.05 : 0.08) + hash(seed, 2) * (layer ? 0.06 : 0.09))
          const leftV: [number, number] = [x, horizon - h * hash(seed, 3) * 0.02]
          const rightV: [number, number] = [x + step * 2, horizon - h * hash(seed + 1, 3) * 0.02]
          const ridgeFoot: [number, number] = [peakX + (hash(seed, 4) - 0.3) * step * 0.4, base]
          // Sun is to the right: right-facing slopes are lit.
          ctx.fillStyle = dark
          ctx.beginPath()
          ctx.moveTo(leftV[0], base)
          ctx.lineTo(leftV[0], leftV[1])
          ctx.lineTo(peakX, peakY)
          ctx.lineTo(ridgeFoot[0], ridgeFoot[1])
          ctx.closePath()
          ctx.fill()
          ctx.fillStyle = lit
          ctx.beginPath()
          ctx.moveTo(peakX, peakY)
          ctx.lineTo(rightV[0], rightV[1])
          ctx.lineTo(rightV[0], base)
          ctx.lineTo(ridgeFoot[0], ridgeFoot[1])
          ctx.closePath()
          ctx.fill()
        }
      }
      // Haze lying over the horizon: the farthest terrain is born inside it, never against the sky.
      const haze = ctx.createLinearGradient(0, horizon, 0, horizon - h * BAND * 2.2)
      haze.addColorStop(0, hsl(HAZE.h, HAZE.s, HAZE.l))
      haze.addColorStop(1 / 2.2, hsl(HAZE.h, HAZE.s, HAZE.l))
      haze.addColorStop(1, hsl(HAZE.h, HAZE.s, HAZE.l, 0))
      ctx.fillStyle = haze
      ctx.fillRect(x0, horizon - h * BAND * 2.2, x1 - x0, h * BAND * 2.2)
      ctx.fillStyle = hsl(HAZE.h, HAZE.s, HAZE.l)
      ctx.fillRect(x0, horizon, x1 - x0, h * 1.2 - horizon)

      // Terrain strips, far to near: two flat-shaded triangles per cell.
      // Speed: within one strip every facet has the same fog, so its color depends
      // only on how it faces the sun. Facets are bucketed into LEVELS shades and each
      // shade is filled as one path (no closePath: fill() closes sub-paths anyway and
      // closePath was the most expensive call). An underlay per strip hides seams.
      const LEVELS = 16
      const paths: (Path2D | null)[] = new Array(LEVELS)
      const addTri = (a: [number, number], b: [number, number], c: [number, number], n: V3) => {
        const lvl = Math.min(LEVELS - 1, Math.round(lightOf(n) * (LEVELS - 1)))
        const path = (paths[lvl] ??= new Path2D())
        path.moveTo(a[0], a[1])
        path.lineTo(b[0], b[1])
        path.lineTo(c[0], c[1])
      }
      const kFirst = Math.floor((travel + Z_NEAR) / CELL) + 1
      // Level boundaries, aligned to the coarser level's cell size so the two meet on a shared row.
      const kBound = LODS.map((lod, i) => {
        const coarser = LODS[Math.min(i + 1, LODS.length - 1)].step
        return Math.ceil((travel + lod.until) / CELL / coarser) * coarser
      })
      const heightAt = (j: number, k: number, lvl: number) =>
        lodHeight(vh, j, k, LODS[lvl].step, lvl >= LODS.length - 1 ? null : (kBound[lvl] - k) * CELL, MORPH)
      const coarsest = LODS[LODS.length - 1].step
      const kLast = Math.ceil((travel + Z_FAR) / CELL / coarsest) * coarsest
      for (let k = kLast; k > kFirst; ) {
        let lvl = 0
        while (lvl < LODS.length - 1 && k > kBound[lvl]) lvl++
        const step = LODS[lvl].step
        const kFar = k
        const kNear = k - step
        k = kNear
        if (kNear < kFirst) break
        const zc = kNear * CELL - travel
        const zFarRow = kFar * CELL - travel
        const reach = (zFarRow * (w * 0.72)) / focal + CELL * step
        const jMin = Math.floor(-reach / CELL / step) * step
        const jMax = Math.ceil(reach / CELL / step) * step
        paths.fill(null)
        const nearEdge: [number, number][] = []
        const farEdge: [number, number][] = []
        let prev0: V3 | null = null
        let prev1: V3 | null = null
        let ps0: [number, number] | null = null
        let ps1: [number, number] | null = null
        for (let j = jMin; j <= jMax; j += step) {
          const p0: V3 = [j * CELL, heightAt(j, kNear, lvl), kNear * CELL]
          const p1: V3 = [j * CELL, heightAt(j, kFar, lvl), kFar * CELL]
          const s0 = project(p0)
          const s1 = project(p1)
          nearEdge.push(s0)
          farEdge.push(s1)
          if (prev0 && prev1 && ps0 && ps1) {
            // Alternate the diagonal so facets don't line up into stripes.
            if ((j / step + kNear / step) & 1) {
              addTri(ps1, s1, ps0, faceNormal(prev0, p1, prev1))
              addTri(ps0, s1, s0, faceNormal(prev0, p0, p1))
            } else {
              addTri(ps1, s1, s0, faceNormal(prev1, p0, p1))
              addTri(ps1, s0, ps0, faceNormal(prev0, p0, prev1))
            }
          }
          prev0 = p0
          prev1 = p1
          ps0 = s0
          ps1 = s1
        }
        ctx.beginPath()
        for (const [x, y] of nearEdge) ctx.lineTo(x, y)
        for (let i = farEdge.length - 1; i >= 0; i--) ctx.lineTo(farEdge[i][0], farEdge[i][1])
        ctx.closePath()
        ctx.fillStyle = shade(lightOf([0, 1, 0]), zc)
        ctx.fill()
        for (let l = 0; l < LEVELS; l++) {
          const path = paths[l]
          if (!path) continue
          ctx.fillStyle = shade(l / (LEVELS - 1), zc)
          ctx.fill(path)
        }
      }

      // Ice dust: thin straight streaks around us, longer when you surge.
      for (let i = 0; i < WIND; i++) {
        wz[i] -= speed * dt
        if (wz[i] < Z_NEAR) placeWind(i, false)
        const z = wz[i]
        const tail = z + speed * 0.05
        const px = w / 2 + (wx[i] / z) * focal
        const py = horizon - (wy[i] / z) * focal
        if (px < x0 || px > x1 || py < -h * 0.2 || py > h * 1.2) continue
        const near = 1 - z / 30
        ctx.strokeStyle = hsl(205, 40, 97, 0.15 + near * 0.4)
        ctx.lineWidth = 0.5 + near * 1.5
        ctx.beginPath()
        ctx.moveTo(w / 2 + (wx[i] / tail) * focal, horizon - (wy[i] / tail) * focal)
        ctx.lineTo(px, py)
        ctx.stroke()
      }
      ctx.restore()
    },
  }
}

export function createScene(id: SceneId): Scene {
  switch (id) {
    case "tunnel":
      return tunnel()
    case "orbit":
      return orbit()
    case "nebula":
      return nebula()
    case "tundra":
      return tundra()
    case "nighttime":
      return nighttime()
    case "drift":
      return drift()
  }
}
