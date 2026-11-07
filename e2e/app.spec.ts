import { expect, test } from "@playwright/test"
import fs from "fs"
import path from "path"
import { buildTaggedMp3, CLIENT_ID, close, launch, MUSIC_VIDEO, shot, skipOnboarding, startFakeAi, startFakeGoogle, VALID_KEY } from "./helpers"

const onboarding = (page: import("@playwright/test").Page) => page.getByRole("dialog", { name: "Setup" })

test.describe("a brand new user", () => {
  test("gets one quick setup screen, with no intro, and can skip it", async () => {
    const { app, page, music, problems } = await launch()
    await expect(page.getByRole("heading", { name: "Quick setup" })).toBeVisible()
    await expect(page.getByText("Welcome")).toHaveCount(0)
    await expect(onboarding(page).getByRole("button", { name: "Choose cookies.txt" })).toBeVisible()
    await expect(onboarding(page).getByRole("button", { name: "Add API key" })).toBeVisible()
    await expect(onboarding(page).getByText(music)).toBeVisible()
    await shot(page, "02-quick-setup")

    await page.getByRole("button", { name: "Skip setup" }).click()
    await expect(onboarding(page)).toBeHidden()
    await expect(page.getByRole("heading", { name: "Let's get some music in here" })).toBeVisible()
    await shot(page, "04-home-empty")
    expect(problems).toEqual([])
    await close(app)
  })

  test("sees setup again if it was left open, and isn't asked again once done", async () => {
    const first = await launch()
    await expect(first.page.getByRole("heading", { name: "Quick setup" })).toBeVisible()
    await close(first.app)

    const second = await launch({ dir: first.dir })
    await expect(second.page.getByRole("heading", { name: "Quick setup" })).toBeVisible()
    await second.page.getByRole("button", { name: "Skip setup" }).click()
    await close(second.app)

    const third = await launch({ dir: first.dir })
    await expect(third.page.getByRole("heading", { name: "Let's get some music in here" })).toBeVisible()
    await expect(onboarding(third.page)).toBeHidden()
    await close(third.app)
  })
})

test("adding an API key during setup finishes it", async () => {
  const google = await startFakeGoogle()
  const { app, page, problems } = await launch({ google })
  await onboarding(page).getByRole("button", { name: "Add API key" }).click()
  await page.getByLabel("Paste the key here").fill(VALID_KEY)
  await page.getByRole("button", { name: "Save key" }).click()
  await expect(onboarding(page)).toBeHidden()
  expect(await page.evaluate(() => window.api.youtube.access())).toMatchObject({ data: { hasApiKey: true } })
  expect(problems).toEqual([])
  await close(app)
  google.close()
})

test("tag options scroll in one list, and the box you type in stays put", async () => {
  const { app, page, problems } = await launch({ music: ["First Song"] })
  await skipOnboarding(page)
  await page.getByText("First Song").first().click()
  await page.keyboard.press("t")
  const dialog = page.getByRole("dialog", { name: /Tags for/ })
  await expect(dialog.getByText("Jazz and blues")).toBeAttached()
  const list = dialog.locator("[data-slot=scroll-area-viewport]")
  const sizes = await list.evaluate((el) => ({ content: el.scrollHeight, shown: el.clientHeight, outerScrolls: el.closest("[role=dialog]")!.querySelector(".overflow-y-auto")!.scrollHeight > el.closest("[role=dialog]")!.querySelector(".overflow-y-auto")!.clientHeight }))
  expect(sizes.content).toBeGreaterThan(sizes.shown)
  expect(sizes.outerScrolls).toBe(false)
  await page.waitForTimeout(300)
  await shot(page, "39-tag-options")

  const box = dialog.getByLabel("New tag")
  const before = await box.boundingBox()
  await list.evaluate((el) => el.scrollTo(0, el.scrollHeight))
  expect((await box.boundingBox())?.y).toBe(before?.y)
  await box.fill("bebop")
  await expect(dialog.getByRole("button", { name: "bebop" })).toBeVisible()
  await expect(dialog.getByText("Jazz and blues")).toBeVisible()
  await expect(dialog.getByText("Rock", { exact: true })).toHaveCount(0)
  expect(problems).toEqual([])
  await close(app)
})

test("the title bar is the theme's, with no menu, and the visualizer survives resizing", async () => {
  const { app, page, data, dir } = await launch({ music: ["Song One"] })
  await skipOnboarding(page)
  await close(app)
  const file = path.join(data, "user.json")
  const saved = JSON.parse(fs.readFileSync(file, "utf-8"))
  saved.settings.visualizer = "tunnel"
  saved.settings.playerBackground = "visualizer"
  fs.writeFileSync(file, JSON.stringify(saved))


  const again = await launch({ dir })
  const onWindows = process.platform === "win32"
  expect(await again.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMenuBarVisible())).toBe(false)
  const bar = again.page.locator("[data-region=title-bar]")
  if (onWindows) {
    await expect(bar).toHaveCSS("height", "32px")
    // Record what the native buttons are told, then change theme.
    await again.app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0] as unknown as { setTitleBarOverlay: (o: unknown) => void }
      const real = win.setTitleBarOverlay.bind(win)
      const seen: unknown[] = ((globalThis as unknown as { seen: unknown[] }).seen = [])
      win.setTitleBarOverlay = (o) => {
        seen.push(o)
        real(o)
      }
    })
    await again.page.evaluate(() => window.api.user.updateSettings({ theme: "red-light" }))
    await expect.poll(() => again.app.evaluate(() => (globalThis as unknown as { seen: { color: string; symbolColor: string }[] }).seen.at(-1))).toMatchObject({ color: expect.stringMatching(/^#[ef]/), symbolColor: expect.stringMatching(/^#[0-3]/) })
    await again.page.evaluate(() => window.api.user.updateSettings({ theme: "red-dark" }))
    await expect.poll(() => again.app.evaluate(() => (globalThis as unknown as { seen: { color: string; symbolColor: string }[] }).seen.at(-1))).toMatchObject({ color: expect.stringMatching(/^#[01]/), symbolColor: expect.stringMatching(/^#[ef]/) })
  }

  await again.page.getByText("Song One").first().click()
  await again.page.keyboard.press("f")
  const canvas = again.page.locator("canvas").first()
  await expect(canvas).toBeVisible()
  await again.page.waitForTimeout(1500) // let Tunnel's picture build up
  const painted = () => canvas.evaluate((el: HTMLCanvasElement) => {
    const { data } = el.getContext("2d")!.getImageData(0, 0, el.width, el.height)
    let lit = 0
    for (let i = 0; i < data.length; i += 4) if (data[i] + data[i + 1] + data[i + 2] > 0) lit++
    return { lit: lit / (data.length / 4), matches: el.width === el.clientWidth && el.height === el.clientHeight }
  })
  for (const [w, h] of [[1000, 700], [1300, 600], [800, 800], [1280, 720]]) {
    await again.app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(size[0], size[1]), [w, h])
    await again.page.waitForTimeout(100)
    const state = await painted()
    expect(state.matches).toBe(true)
    expect(state.lit).toBeGreaterThan(0.9) // never a blank frame
  }
  if (onWindows) {
    const below = await canvas.boundingBox()
    expect(below?.y).toBe(32)
  }
  await shot(again.page, "40-visualizer-after-resize")
  expect(again.problems).toEqual([])
  await close(again.app)
})

test("an existing user with music isn't sent through setup", async () => {
  // Written by an earlier version, which had no onboarding setting.
  const seeded = await launch({ music: ["Old Song"] })
  await skipOnboarding(seeded.page)
  await close(seeded.app)
  const userFile = path.join(seeded.data, "user.json")
  const saved = JSON.parse(fs.readFileSync(userFile, "utf-8"))
  delete saved.settings.onboarding
  fs.writeFileSync(userFile, JSON.stringify(saved))

  const { app, page } = await launch({ dir: seeded.dir })
  await expect(page.getByRole("heading", { name: "Quick picks" })).toBeVisible()
  await expect(onboarding(page)).toBeHidden()
  await close(app)
})

test.describe("with no YouTube at all", () => {
  test("the whole app works, and nothing contacts Google", async () => {
    const google = await startFakeGoogle()
    const { app, page, problems } = await launch({ google, music: ["First Song", "Second Song"] })
    await skipOnboarding(page)

    await expect(page.getByRole("heading", { name: "Quick picks" })).toBeVisible()
    await shot(page, "05-home-with-music")

    // The song found in the default folder really plays, past the content security policy.
    const songs = await page.evaluate(async () => (await window.api.library.get()) as unknown as { data: { songs: { id: string }[] } })
    expect(songs.data.songs).toHaveLength(2)
    const media = await page.evaluate(async (id) => (await fetch(`media://song/${encodeURIComponent(id)}`)).status, songs.data.songs[0].id)
    expect(media).toBe(200)

    await page.getByText("First Song").first().click()
    await expect(page.getByRole("button", { name: /pause/i }).first()).toBeVisible()
    await shot(page, "06-playing")

    expect(google.state.hits).toEqual([])
    expect((await page.evaluate(() => window.api.tools.ytDlpState())) as unknown).toMatchObject({ data: { status: "idle" } })
    expect(problems).toEqual([])
    await close(app)
    google.close()
  })

  test("no screen is left blank for someone with no songs", async () => {
    const { app, page } = await launch()
    await skipOnboarding(page)
    await page.getByRole("button", { name: "Library", exact: true }).first().click()
    for (const [tab, text] of [
      ["Albums", "No albums yet"],
      ["Artists", "No artists yet"],
      ["Songs", "No songs yet"],
      ["Tags", "No tags yet"],
    ]) {
      await page.getByRole("tab", { name: tab }).click()
      await expect(page.getByText(text)).toBeVisible()
    }
    await shot(page, "07-library-empty")
    await close(app)
  })
})

test("a liked video you already own becomes a like once, and unliking it sticks", async () => {
  const google = await startFakeGoogle()
  const { app, page, music, dir } = await launch({ google })
  await skipOnboarding(page)
  fs.copyFileSync(path.join(music, "..", "seed.mp3"), path.join(music, `Band - Great Song [${MUSIC_VIDEO.id}].mp3`))
  const librarySize = async () => ((await page.evaluate(async () => { await window.api.library.rescan(); return window.api.library.get() })) as unknown as { data: { songs: unknown[] } }).data.songs.length
  await expect.poll(librarySize).toBe(1)
  const likes = async () => ((await page.evaluate(() => window.api.user.get())) as unknown as { data: { likes: { songId: string }[] } }).data.likes.map((l) => l.songId)

  await page.evaluate((id) => window.api.youtube.setClient({ clientId: id, clientSecret: "s" }), CLIENT_ID)
  await page.evaluate(() => window.api.youtube.connect())
  const liked = await likes()
  expect(liked).toHaveLength(1)

  await page.evaluate((id) => window.api.user.setLiked(id, false), liked[0])
  await page.evaluate(() => window.api.youtube.refreshAccount())
  expect(await likes()).toEqual([])
  await close(app)

  const again = await launch({ google, dir })
  await again.page.evaluate(() => window.api.youtube.refreshAccount())
  const after = (await again.page.evaluate(() => window.api.user.get())) as unknown as { data: { likes: unknown[] } }
  expect(after.data.likes).toEqual([])
  await close(again.app)
  google.close()
})

test("F11 fills the whole monitor, and F11 again goes back", async () => {
  const { app, page } = await launch({ music: ["Song"] })
  await skipOnboarding(page)
  const state = () =>
    app.evaluate(({ BrowserWindow, screen }) => {
      const win = BrowserWindow.getAllWindows()[0]
      const { width, height } = win.getContentBounds()
      return { fullscreen: win.isFullScreen(), width, height, display: screen.getPrimaryDisplay().size }
    })
  // Through Electron's own input path: a key sent over the debugger skips before-input-event.
  const pressF11 = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.sendInputEvent({ type: "keyDown", keyCode: "F11" }))
  const before = await state()
  expect(before.fullscreen).toBe(false)

  await pressF11()
  await expect.poll(async () => (await state()).fullscreen).toBe(true)
  await expect.poll(async () => { const s = await state(); return [s.width, s.height] }).toEqual([before.display.width, before.display.height])
  await expect.poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([before.display.width, before.display.height])
  await shot(page, "18-fullscreen")

  await pressF11()
  await expect.poll(async () => (await state()).fullscreen).toBe(false)
  await close(app)
})

test("the full screen button sits beside the keyboard button and stays in sync", async () => {
  const { app, page } = await launch()
  await skipOnboarding(page)
  const isFull = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())
  const full = page.getByRole("button", { name: "Full screen (F11)" })
  const keyboard = page.getByRole("button", { name: "Keyboard shortcuts (Ctrl+/)" })
  const [a, b] = [await full.boundingBox(), await keyboard.boundingBox()]
  expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x)
  expect(b!.x - (a!.x + a!.width)).toBeLessThan(24)
  await full.click()
  await expect.poll(isFull).toBe(true)
  const exit = page.getByRole("button", { name: "Exit full screen (F11)" })
  await expect(exit).toBeVisible()
  await shot(page, "26-fullscreen-button")
  await exit.click()
  await expect.poll(isFull).toBe(false)
  // F11 changes it too, and the button follows.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.sendInputEvent({ type: "keyDown", keyCode: "F11" }))
  await expect(exit).toBeVisible()
  await close(app)
})

test("tabbing never pushes the app off screen", async () => {
  const { app, page } = await launch({ music: ["Song One", "Song Two"] })
  await skipOnboarding(page)
  const offsets = () =>
    page.evaluate(() => {
      const moved: string[] = []
      for (const el of document.querySelectorAll("*")) {
        if (el.scrollLeft !== 0 && getComputedStyle(el).overflowX !== "auto" && getComputedStyle(el).overflowX !== "scroll") moved.push(el.tagName + "." + el.className)
      }
      const a = document.activeElement
      const r = a && a !== document.body ? a.getBoundingClientRect() : null
      return { moved, offRight: r ? r.left >= window.innerWidth : false, label: a?.getAttribute("aria-label") ?? a?.textContent?.slice(0, 30) }
    })
  const tabThrough = async (times: number) => {
    for (let i = 0; i < times; i++) {
      await page.keyboard.press("Tab")
      const now = await offsets()
      expect(now.moved, `after tab ${i}, on ${now.label}`).toEqual([])
      expect(now.offRight, `after tab ${i}, focus went off screen on ${now.label}`).toBe(false)
    }
  }
  await tabThrough(50)
  await page.getByText("Song One").first().click()
  await page.keyboard.press("f")
  await page.waitForTimeout(600)
  await tabThrough(50)
  await close(app)
})

test("Tundra and Nebula are gone, and a saved choice of them still works", async () => {
  const { app, page, data, dir } = await launch({ music: ["Song One"] })
  await skipOnboarding(page)
  await close(app)
  const file = path.join(data, "user.json")
  const saved = JSON.parse(fs.readFileSync(file, "utf-8"))
  saved.settings.visualizer = "tundra"
  saved.settings.playerBackground = "visualizer"
  fs.writeFileSync(file, JSON.stringify(saved))
  const again = await launch({ dir })
  await again.page.getByText("Song One").first().click()
  await again.page.keyboard.press("f")
  await again.page.waitForTimeout(500)
  expect(again.problems).toEqual([])
  await again.page.keyboard.press("f")
  await again.page.getByRole("button", { name: "Settings" }).click()
  await again.page.getByRole("tab", { name: "Appearance" }).click()
  await expect(again.page.getByText(/Tundra|Nebula/)).toHaveCount(0)
  await close(again.app)
})

test("page titles aren't clipped: the y in Recently played shows in full", async () => {
  const { app, page } = await launch()
  await skipOnboarding(page)
  await page.getByRole("button", { name: "History", exact: true }).first().click()
  const title = page.getByRole("heading", { name: "Recently played" })
  await expect(title).toBeVisible()
  const fit = await title.evaluate((el) => {
    // Measure the glyphs themselves, descenders included, against the box that clips them.
    const canvas = document.createElement("canvas").getContext("2d")!
    canvas.font = getComputedStyle(el).font
    const text = canvas.measureText(el.textContent ?? "")
    const range = document.createRange()
    range.selectNodeContents(el)
    const box = el.getBoundingClientRect()
    const line = range.getBoundingClientRect()
    return { spaceBelowBaseline: box.bottom - (line.top + (line.height + text.actualBoundingBoxAscent - text.actualBoundingBoxDescent) / 2), descent: text.actualBoundingBoxDescent }
  })
  expect(fit.spaceBelowBaseline).toBeGreaterThanOrEqual(fit.descent)
  await shot(page, "37-history-title")
  await close(app)
})

test("random buttons are for songs only", async () => {
  const { app, page } = await launch({ music: ["Song One"] })
  await skipOnboarding(page)
  await expect(page.getByRole("button", { name: "Play a random playlist" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Play a random song" }).first()).toBeVisible()
  await close(app)
})

test("the landing page fills its row with albums when there aren't enough playlists", async () => {
  const seeded = await launch()
  await skipOnboarding(seeded.page)
  await close(seeded.app)
  // Real album tags, from the ffmpeg-free test MP3 with an album frame.
  for (const album of ["First Album", "Second Album"]) fs.writeFileSync(path.join(seeded.music, `${album}.mp3`), buildTaggedMp3(album, album))
  const { app, page } = await launch({ dir: seeded.dir })
  await expect(page.getByRole("heading", { name: "Playlists and albums" })).toBeVisible()
  await expect(page.getByText("Album ·").first()).toBeVisible()
  await expect(page.getByText("First Album").first()).toBeVisible()
  await shot(page, "30-home-shelf")
  await close(app)
})

test.describe("the YouTube page", () => {
  const slowLookup = (app: import("@playwright/test").ElectronApplication, ms: number) =>
    app.evaluate(({ ipcMain }, delay) => {
      ipcMain.removeHandler("youtube:lookup-link")
      ipcMain.handle("youtube:lookup-link", async () => {
        await new Promise((r) => setTimeout(r, delay))
        return { ok: true, data: { playlists: [{ id: "PLabc", title: "Linked playlist", channel: "Someone", thumbnail: null, count: 1, videos: [{ id: "jNQXAC9IVRw", title: "A song", channel: "Someone", duration: 60, thumbnail: null }] }] } }
      })
    }, ms)
  const openPage = (page: import("@playwright/test").Page) => page.getByRole("button", { name: "YouTube", exact: true }).first().click()

  test("the search box is always there and focused, and the button says what it'll do", async () => {
    const { app, page } = await launch()
    await skipOnboarding(page)
    await openPage(page)
    const box = page.getByLabel("Search YouTube")
    await expect(box).toBeFocused()
    await expect(page.getByRole("tab", { name: "Your playlists" })).toHaveAttribute("data-state", "active")
    await box.fill("some words")
    await expect(page.getByRole("button", { name: "Search", exact: true })).toBeVisible()
    await box.fill("https://www.youtube.com/playlist?list=PLabc123")
    await expect(page.getByRole("button", { name: "Open playlist" })).toBeVisible()
    await box.fill("https://youtu.be/jNQXAC9IVRw")
    await expect(page.getByRole("button", { name: "Open video" })).toBeVisible()
    await box.fill("jNQXAC9IVRw")
    await expect(page.getByRole("button", { name: "Open video" })).toBeVisible()
    await shot(page, "31-youtube-page")
    await close(app)
  })

  test("a link opens without an API key, showing a skeleton and the top progress bar while it loads", async () => {
    const { app, page, problems } = await launch()
    await skipOnboarding(page)
    await slowLookup(app, 1500)
    await openPage(page)
    await page.getByLabel("Search YouTube").fill("https://www.youtube.com/playlist?list=PLabc123")
    await page.getByRole("button", { name: "Open playlist" }).click()
    await expect(page.getByTestId("search-skeleton")).toBeVisible()
    const bar = page.locator('[aria-label="Loading"]') // not by role: when idle it's hidden from assistive tech
    await expect.poll(async () => Number(await bar.getAttribute("aria-valuenow"))).toBeGreaterThan(20)
    await page.waitForTimeout(300)
    await shot(page, "32-loading")
    await expect(page.getByText("Linked playlist")).toBeVisible()
    await expect(page.getByTestId("search-skeleton")).toHaveCount(0)
    await expect(page.getByRole("tab", { name: "Results" })).toHaveAttribute("data-state", "active")
    await expect.poll(async () => bar.getAttribute("aria-hidden")).toBe("true")
    expect(problems).toEqual([])
    await close(app)
  })

  test("words without a key explain the choice instead of failing", async () => {
    const { app, page } = await launch()
    await skipOnboarding(page)
    await openPage(page)
    await page.getByLabel("Search YouTube").fill("some song")
    await page.keyboard.press("Enter")
    await expect(page.getByText("Searching by words needs an API key", { exact: false })).toBeVisible()
    await expect(page.getByRole("button", { name: "Add API key" })).toBeVisible()
    await shot(page, "33-search-needs-key")
    await close(app)
  })

  test("your playlists load with a skeleton, not a line of text", async () => {
    const { app, page, dir } = await launch()
    await skipOnboarding(page)
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler("youtube:my-playlists")
      ipcMain.handle("youtube:my-playlists", async () => {
        await new Promise((r) => setTimeout(r, 1500))
        return { ok: true, data: [{ id: "PLroad", title: "Road trip", count: 12, thumbnail: null }] }
      })
      ipcMain.removeHandler("youtube:access")
    })
    await app.evaluate(({ ipcMain }) => {
      ipcMain.handle("youtube:access", () => ({ ok: true, data: { hasApiKey: false, hasOAuthClient: false, connected: false, needsReconnect: false, channel: null, cookieMode: true, secureStorage: true, unreadable: [] } }))
    })
    void dir
    await page.evaluate(() => window.api.youtube.setAuth({ mode: "browser" }))
    await openPage(page)
    await expect(page.getByTestId("playlist-skeleton")).toBeVisible()
    await expect(page.getByText("Loading your playlists")).toHaveCount(0)
    await expect(page.getByText("Road trip")).toBeVisible()
    await expect(page.getByTestId("playlist-skeleton")).toHaveCount(0)
    await close(app)
  })
})

test("themes come from files, and each has depth", async () => {
  const { app, page } = await launch({ music: ["Song One"] })
  await skipOnboarding(page)
  const colors = () =>
    page.evaluate(() => {
      const probe = (cls: string) => {
        const el = document.createElement("div")
        el.className = cls
        document.body.append(el)
        const value = getComputedStyle(el).backgroundColor
        el.remove()
        return value
      }
      return { theme: document.documentElement.dataset.theme, isDark: document.documentElement.classList.contains("dark"), base: probe("bg-background"), dark: probe("bg-background-dark"), light: probe("bg-background-light") }
    })
  const dark = await colors()
  expect(dark).toMatchObject({ theme: "red-dark", isDark: true })
  expect(new Set([dark.base, dark.dark, dark.light]).size).toBe(3)
  await shot(page, "34-theme-dark")

  await page.evaluate(() => window.api.user.updateSettings({ theme: "light" }))
  await expect.poll(async () => (await colors()).theme).toBe("light")
  const light = await colors()
  expect(light.isDark).toBe(false)
  expect(light.base).not.toBe(dark.base)
  expect(new Set([light.base, light.dark, light.light]).size).toBe(3)
  await shot(page, "35-theme-light")

  // A theme saved under an id that no longer exists falls back, rather than losing all color.
  await page.evaluate(() => window.api.user.updateSettings({ theme: "was-deleted" }))
  await expect.poll(async () => (await colors()).theme).toBe("red-dark")

  await page.getByRole("button", { name: "Settings" }).click()
  await page.getByRole("tab", { name: "Appearance" }).click()
  for (const name of ["Dark", "Light", "Midnight", "Sunset"]) await expect(page.getByRole("dialog").getByText(name, { exact: true }).first()).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, "36-theme-picker")
  await close(app)
})

test("every settings tab and step is the same dialog size, and scrolls inside", async () => {
  const { app, page } = await launch()
  await skipOnboarding(page)
  await page.getByRole("button", { name: "Settings" }).click()
  const dialog = page.getByRole("dialog")
  const sizes: number[] = []
  for (const tab of ["Appearance", "Playback", "Library", "YouTube", "AI tagging"]) {
    await page.getByRole("tab", { name: tab }).click()
    await page.waitForTimeout(250)
    const box = await dialog.boundingBox()
    sizes.push(Math.round(box!.height))
    expect(box!.y + box!.height).toBeLessThanOrEqual((await page.evaluate(() => window.innerHeight)) + 1)
  }
  expect(new Set(sizes).size).toBe(1)
  await shot(page, "27-settings-ai")
  await page.keyboard.press("Escape")

  // Other dialogs match it.
  await page.getByRole("button", { name: "Keyboard shortcuts (Ctrl+/)" }).click()
  await page.waitForTimeout(250)
  expect(Math.round((await dialog.boundingBox())!.height)).toBe(sizes[0])
  await close(app)
})

test.describe("AI tagging", () => {
  const openAi = async (page: import("@playwright/test").Page) => {
    await page.getByRole("button", { name: "Settings" }).click()
    await page.getByRole("tab", { name: "AI tagging" }).click()
  }
  const KEY = "fake-provider-key-for-end-to-end-tests"

  test("tags only untagged songs, using the chosen provider, and keeps the key out of the page", async () => {
    const ai = await startFakeAi()
    const { app, page, data } = await launch({ ai, music: ["Song One", "Song Two"] })
    await skipOnboarding(page)
    const ids = await page.evaluate(async () => ((await window.api.library.get()) as unknown as { data: { songs: { id: string; metadata: { title: string } }[] } }).data.songs.map((s) => ({ id: s.id, title: s.metadata.title })))
    const mine = ids.find((s) => s.title === "Song One")!
    await page.evaluate((id) => window.api.user.setSongTags([id], ["my own tag"]), mine.id)

    await openAi(page)
    await expect(page.getByText("1 song has no tags")).toBeVisible()
    await expect(page.getByRole("button", { name: /Tag 1 song/ })).toBeDisabled()
    expect(ai.state.requests).toEqual([]) // nothing is sent until asked

    await page.getByRole("button", { name: "Add key" }).click()
    await page.getByLabel("Paste your Claude key").fill("rejected-key-that-is-long-enough")
    await page.getByRole("button", { name: "Save key" }).click()
    await expect(page.getByRole("alert").filter({ hasText: "isn't valid" })).toBeVisible()
    await page.getByLabel("Paste your Claude key").fill(KEY)
    await page.getByRole("button", { name: "Save key" }).click()
    await expect(page.getByText("Your key is set.")).toBeVisible()
    await shot(page, "28-ai-ready")

    await page.getByRole("button", { name: /Tag 1 song/ }).click()
    await expect(page.getByText("Tagged 1 song.")).toBeVisible()
    await expect(page.getByText("Every song has tags")).toBeVisible()
    await shot(page, "29-ai-done")

    const tags = await page.evaluate(async () => ((await window.api.user.get()) as unknown as { data: { songTags: Record<string, string[]> } }).data.songTags)
    const other = ids.find((s) => s.title === "Song Two")!
    expect(tags[mine.id]).toEqual(["my own tag"])
    expect(tags[other.id]).toEqual(["chill"]) // the made-up tag was dropped

    const sent = ai.state.requests.find((r) => r.path.endsWith("/v1/messages"))!
    expect(sent.headers["x-api-key"]).toBe(KEY)
    expect(sent.body).toContain("Song Two")
    expect(sent.body).not.toContain("Song One")
    expect(sent.body).not.toContain(path.dirname(data))

    expect(JSON.stringify(await page.evaluate(() => window.api.ai.status()))).not.toContain(KEY)
    expect(fs.readFileSync(path.join(data, "credentials", "youtube-anthropicKey.enc"), "utf-8")).not.toContain(KEY)
    expect(fs.readFileSync(path.join(data, "user.json"), "utf-8")).not.toContain(KEY)
    await close(app)
    ai.close()
  })

  test("OpenAI has its own key, and goes to its own endpoint", async () => {
    const ai = await startFakeAi()
    const { app, page } = await launch({ ai, music: ["Song One"] })
    await skipOnboarding(page)
    await openAi(page)
    await page.getByRole("radio", { name: "OpenAI" }).click()
    await expect(page.getByRole("radio", { name: /GPT-6 Luna/ })).toBeVisible()
    await expect(page.getByText(/songs per \$1/).first()).toBeVisible()
    await expect(page.getByRole("button", { name: /Tag 1 song/ })).toBeDisabled()
    await page.getByRole("button", { name: "Add key" }).click()
    await page.getByLabel("Paste your OpenAI key").fill(KEY)
    await page.getByRole("button", { name: "Save key" }).click()
    await page.getByRole("radio", { name: /High/ }).click()
    await page.getByRole("button", { name: /Tag 1 song/ }).click()
    await expect(page.getByText("Tagged 1 song.")).toBeVisible()
    const sent = ai.state.requests.find((r) => r.path.endsWith("/v1/responses"))!
    expect(sent.headers.authorization).toBe(`Bearer ${KEY}`)
    expect(JSON.parse(sent.body).model).toBe("gpt-6.1-sol")
    await close(app)
    ai.close()
  })
})

test("the setup walkthroughs fit on a laptop screen", async () => {
  const { app, page } = await launch()
  await skipOnboarding(page)
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 720))
  await page.getByRole("button", { name: "YouTube", exact: true }).first().click()
  await page.getByText("Other options").click()
  await page.getByRole("button", { name: "Connect Google" }).click()
  const save = page.getByRole("button", { name: "Save and continue" })
  await save.scrollIntoViewIfNeeded()
  await expect(save).toBeInViewport()
  await page.waitForTimeout(400)
  await shot(page, "17-walkthrough-720p")
  await close(app)
})

test.describe("cookies.txt, the main way in", () => {
  const COOKIES = ["# Netscape HTTP Cookie File", [".youtube.com", "TRUE", "/", "TRUE", "1999999999", "SAPISID", "yt-secret"].join("\t"), [".mybank.com", "TRUE", "/", "TRUE", "1999999999", "BANK", "bank-secret"].join("\t")].join("\n")

  /** The file picker is the OS's, so answer it directly. Everything after it is the real app. */
  const answerFilePicker = (app: import("@playwright/test").ElectronApplication, file: string) =>
    app.evaluate(({ dialog }, chosen) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [chosen] })) as typeof dialog.showOpenDialog
    }, file)
  /** yt-dlp would reject made-up cookies, so stand in for YouTube's answers. */
  const fakeYoutube = (app: import("@playwright/test").ElectronApplication) =>
    app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler("youtube:my-playlists")
      ipcMain.handle("youtube:my-playlists", () => ({ ok: true, data: [{ id: "LL", title: "Liked videos", count: null, thumbnail: null, system: true }, { id: "PLroad", title: "Road trip", count: 12, thumbnail: null }] }))
      ipcMain.removeHandler("youtube:playlist-count")
      ipcMain.handle("youtube:playlist-count", () => ({ ok: true, data: 340 }))
    })

  test("first run: upload, then straight to picking, in very few clicks", async () => {
    const { app, page, dir, data, problems } = await launch()
    const file = path.join(dir, "cookies.txt")
    fs.writeFileSync(file, COOKIES)
    await answerFilePicker(app, file)
    await fakeYoutube(app)

    await expect(page.getByRole("button", { name: "Choose cookies.txt" })).toBeVisible()
    await shot(page, "21-cookies-onboarding")
    await page.getByRole("button", { name: "Choose cookies.txt" }).click()

    await expect(page.getByRole("heading", { name: "What should come in?" })).toBeVisible()
    await expect(onboarding(page).getByText("Liked videos")).toBeVisible()
    await expect(onboarding(page).getByText("Road trip")).toBeVisible()
    await expect(onboarding(page).getByRole("checkbox", { name: /Liked videos.*340 videos/ })).not.toBeChecked()
    await expect(onboarding(page).getByRole("checkbox", { name: /Road trip.*12 videos/ })).not.toBeChecked()
    await shot(page, "22-cookies-picker")
    expect(await page.evaluate(() => window.api.youtube.access())).toMatchObject({ data: { cookieMode: true, hasApiKey: false } })

    // Only what YouTube needs was kept, and it never comes back to the page.
    const stored = fs.readFileSync(path.join(data, "credentials", "youtube-cookies.txt"), "utf-8")
    expect(stored.split("\n")[0]).toBe("# Netscape HTTP Cookie File")
    expect(stored).toContain("yt-secret")
    expect(stored).not.toContain("bank-secret")
    expect(JSON.stringify(await page.evaluate(() => window.api.youtube.authStatus()))).not.toContain("yt-secret")

    await onboarding(page).getByRole("button", { name: "Not now" }).click()
    await expect(onboarding(page)).toBeHidden()
    expect(problems).toEqual([])
    await close(app)
  })

  test("starting an import closes the picker and says so before the playlists are read", async () => {
    const { app, page, dir, problems } = await launch()
    const file = path.join(dir, "cookies.txt")
    fs.writeFileSync(file, COOKIES)
    await answerFilePicker(app, file)
    await fakeYoutube(app)
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler("youtube:playlist-items")
      ipcMain.handle("youtube:playlist-items", async () => {
        await new Promise((r) => setTimeout(r, 1500))
        return { ok: true, data: { id: "PLroad", title: "Road trip", channel: "", videos: [{ id: "aaaaaaaaaaa", title: "A song", channel: "", duration: 100, thumbnail: null, unavailable: false }] } }
      })
      ipcMain.removeHandler("youtube:enqueue")
      ipcMain.handle("youtube:enqueue", () => ({ ok: true, data: { items: [{ status: "queued" }], playlistId: "x" } }))
    })
    await page.getByRole("button", { name: "Choose cookies.txt" }).click()
    await expect(onboarding(page).getByRole("button", { name: "Download", exact: true })).toBeDisabled()
    await onboarding(page).getByRole("checkbox", { name: /Road trip/ }).check()
    await onboarding(page).getByRole("button", { name: "Download", exact: true }).click()
    await expect(onboarding(page)).toBeHidden()
    await expect(page.getByText("Import scheduled")).toBeVisible()
    await expect(page.getByText("Importing 1 song", { exact: true })).toBeVisible()
    expect(problems).toEqual([])
    await close(app)
  })

  test("the wrong file gets a clear explanation, and nothing is stored", async () => {
    const { app, page, dir, data } = await launch()
    await skipOnboarding(page)
    const json = path.join(dir, "cookies.json")
    fs.writeFileSync(json, JSON.stringify([{ domain: ".youtube.com", name: "SID" }]))
    await answerFilePicker(app, json)
    await page.getByRole("button", { name: "YouTube", exact: true }).first().click()
    await page.getByRole("button", { name: "Choose cookies.txt" }).click()
    await expect(page.getByRole("alert").filter({ hasText: "Netscape" })).toBeVisible()
    await shot(page, "23-cookies-wrong-file")
    expect(fs.existsSync(path.join(data, "credentials", "youtube-cookies.txt"))).toBe(false)
    await close(app)
  })

  test("a file exported while signed out is turned away, with what to do instead", async () => {
    const { app, page, dir, data } = await launch()
    await skipOnboarding(page)
    const file = path.join(dir, "cookies.txt")
    fs.writeFileSync(file, ["# Netscape HTTP Cookie File", [".youtube.com", "TRUE", "/", "TRUE", "1999999999", "PREF", "x"].join("\t")].join("\n"))
    await answerFilePicker(app, file)
    await page.getByRole("button", { name: "YouTube", exact: true }).first().click()
    await page.getByRole("button", { name: "Choose cookies.txt" }).click()
    await expect(page.getByRole("alert").filter({ hasText: "signed out" })).toBeVisible()
    expect(fs.existsSync(path.join(data, "credentials", "youtube-cookies.txt"))).toBe(false)
    await close(app)
  })

  test("when YouTube rejects the cookies, it says so, and fixing it is one click", async () => {
    const { app, page, dir, data, problems } = await launch()
    await skipOnboarding(page)
    const file = path.join(dir, "cookies.txt")
    fs.writeFileSync(file, COOKIES)
    await answerFilePicker(app, file)
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler("youtube:my-playlists")
      let calls = 0
      ipcMain.handle("youtube:my-playlists", () => (++calls === 1 ? { ok: false, error: { code: "AUTH_EXPIRED", message: "YouTube didn't accept your sign-in." } } : { ok: true, data: [{ id: "PLroad", title: "Road trip", count: 12, thumbnail: null }] }))
    })
    await page.getByRole("button", { name: "YouTube", exact: true }).first().click()
    await page.getByRole("button", { name: "Choose cookies.txt" }).click()
    await expect(page.getByText("YouTube didn't accept your sign-in.")).toBeVisible()
    await expect(page.getByText(/HTTP Error|401/)).toHaveCount(0)
    await shot(page, "38-cookies-rejected")
    await page.getByRole("button", { name: "Upload new cookies.txt" }).click()
    await expect(page.getByText("Road trip")).toBeVisible()
    await expect(page.getByText("YouTube didn't accept your sign-in.")).toHaveCount(0)
    expect(fs.existsSync(path.join(data, "credentials", "youtube-cookies.txt"))).toBe(true)
    expect(problems).toEqual([])
    await close(app)
  })

  test("the YouTube page opens on your playlists after uploading", async () => {
    const { app, page, dir } = await launch()
    await skipOnboarding(page)
    const file = path.join(dir, "cookies.txt")
    fs.writeFileSync(file, COOKIES)
    await answerFilePicker(app, file)
    await fakeYoutube(app)
    await page.getByRole("button", { name: "YouTube", exact: true }).first().click()
    await shot(page, "24-youtube-page-cookies")
    await page.getByRole("button", { name: "Choose cookies.txt" }).click()
    await expect(page.getByText("Road trip")).toBeVisible()
    await expect(page.getByRole("tab", { name: "Your playlists" })).toHaveAttribute("data-state", "active")
    await close(app)
  })

  test("settings lead with the file, and the rest are under other options", async () => {
    const { app, page } = await launch()
    await skipOnboarding(page)
    await page.getByRole("button", { name: "Settings" }).click()
    await page.getByRole("tab", { name: "YouTube" }).click()
    await expect(page.getByRole("button", { name: "Choose cookies.txt" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Add API key" })).toBeHidden()
    await page.getByText("Other options").click()
    await expect(page.getByRole("button", { name: "Add API key" })).toBeVisible()
    await page.waitForTimeout(300)
    await shot(page, "25-settings-cookies")
    await close(app)
  })
})

test.describe("YouTube access has two separate layers", () => {
  test("locked: the page explains both, and search is refused in the main process too", async () => {
    const google = await startFakeGoogle()
    const { app, page } = await launch({ google })
    await skipOnboarding(page)
    await page.getByRole("button", { name: "YouTube", exact: true }).first().click()
    await expect(page.getByText("YouTube is optional", { exact: false })).toBeVisible()
    // Cookies are the main way in, and the others are one click further away.
    await expect(page.getByRole("button", { name: "Choose cookies.txt" })).toBeVisible()
    await expect(page.getByText("Netscape", { exact: false }).first()).toBeVisible()
    await expect(page.getByRole("button", { name: "Add API key" })).toBeHidden()
    await page.getByText("Other options").click()
    await expect(page.getByRole("button", { name: "Add API key" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Connect Google" })).toBeVisible()
    await shot(page, "08-youtube-locked")
    const refused = await page.evaluate(() => window.api.youtube.searchVideos("x", { safeSearch: false, musicOnly: false }))
    expect(refused).toMatchObject({ ok: false, error: { code: "API_KEY_MISSING" } })
    expect(google.state.hits).toEqual([])
    await close(app)
    google.close()
  })

  test("API key only: search works, your data stays locked, and the key never comes back", async () => {
    const google = await startFakeGoogle()
    const { app, page, data } = await launch({ google })
    await skipOnboarding(page)
    await page.getByRole("button", { name: "YouTube", exact: true }).first().click()
    await page.getByText("Other options").click()
    await page.getByRole("button", { name: "Add API key" }).click()
    await shot(page, "09-api-key-walkthrough")

    await page.getByLabel("Paste the key here").fill("this-is-not-a-real-key-at-all")
    await page.getByRole("button", { name: "Save key" }).click()
    await expect(page.getByRole("alert").filter({ hasText: "isn't valid" })).toBeVisible()

    await page.getByLabel("Paste the key here").fill(VALID_KEY)
    await page.getByRole("button", { name: "Save key" }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await page.getByLabel("Search YouTube").fill("great song")
    await page.getByRole("button", { name: "Search", exact: true }).click()
    await expect(page.getByText(MUSIC_VIDEO.title)).toBeVisible()
    await shot(page, "10-search-results")

    await page.getByRole("tab", { name: "Your playlists" }).click()
    await expect(page.getByRole("button", { name: "Choose cookies.txt" })).toBeVisible()

    // Not readable from the page, and not stored in plaintext.
    const access = JSON.stringify(await page.evaluate(() => window.api.youtube.access()))
    expect(access).not.toContain(VALID_KEY)
    const stored = fs.readFileSync(path.join(data, "credentials", "youtube-apiKey.enc"), "utf-8")
    expect(stored).not.toContain(VALID_KEY)
    expect(fs.readFileSync(path.join(data, "user.json"), "utf-8")).not.toContain(VALID_KEY)
    await close(app)

    const again = await launch({ dir: path.dirname(data), google })
    expect(await again.page.evaluate(() => window.api.youtube.access())).toMatchObject({ data: { hasApiKey: true } })
    await close(again.app)
    google.close()
  })

  test("Google only: your data loads, search stays locked, and you pick what to download", async () => {
    const google = await startFakeGoogle()
    const { app, page, data } = await launch({ google })
    await page.getByText("Other options").click()
    await page.getByRole("button", { name: "Connect Google" }).click()
    await shot(page, "11-google-walkthrough")

    await page.getByLabel("Client ID").fill("not-a-client-id")
    await page.getByRole("button", { name: "Save and continue" }).click()
    await expect(page.getByRole("alert").filter({ hasText: "client ID" })).toBeVisible()
    await page.getByLabel("Client ID").fill(CLIENT_ID)
    await page.getByLabel("Client secret").fill("fake-secret")
    await page.getByRole("button", { name: "Save and continue" }).click()

    await expect(page.getByText("What this does")).toBeVisible()
    await expect(page.getByText("read your watch history", { exact: false })).toBeVisible()
    await shot(page, "12-google-explain")
    await page.getByRole("button", { name: "Continue to Google" }).click()

    await expect(page.getByRole("button", { name: "Next" })).toBeVisible()
    await page.keyboard.press("Escape").catch(() => {})
    await page.getByRole("button", { name: "Next" }).click()
    await expect(page.getByRole("heading", { name: "What should come in?" })).toBeVisible()
    await expect(onboarding(page).getByText("Liked videos", { exact: true })).toBeVisible()
    await expect(onboarding(page).getByText("Road trip")).toBeVisible()
    await expect(onboarding(page).getByText("You follow 1 channel.", { exact: false })).toBeVisible()
    await shot(page, "13-picker")

    // Nothing downloads until it's asked for, and the non-music like starts unticked.
    expect(await page.evaluate(() => window.api.youtube.downloads())).toMatchObject({ data: [] })
    await expect(onboarding(page).getByText("1 new")).toBeVisible()
    await onboarding(page).getByRole("button", { name: "Not now" }).click()
    await expect(onboarding(page)).toBeHidden()

    expect(new URLSearchParams(google.state.lastTokenBody).get("code_verifier")).toBeTruthy()
    expect(await page.evaluate(() => window.api.youtube.access())).toMatchObject({ data: { connected: true, hasApiKey: false, channel: { title: "Test Person" } } })
    await expect(page.getByText("From your YouTube")).toBeVisible()
    await shot(page, "14-home-suggestions")

    await page.getByRole("button", { name: "YouTube", exact: true }).first().click()
    await expect(page.getByText("Road trip")).toBeVisible() // your own playlists are what you land on
    await shot(page, "15-my-playlists")
    await page.getByLabel("Search YouTube").fill("words")
    await page.getByRole("button", { name: "Search", exact: true }).click()
    await expect(page.getByRole("button", { name: "Add API key" })).toBeVisible() // search still needs its own key
    await page.getByRole("tab", { name: "Your playlists" }).click()

    for (const file of ["youtube-oauthClient.enc", "youtube-oauthToken.enc"]) {
      const stored = fs.readFileSync(path.join(data, "credentials", file), "utf-8")
      expect(stored).not.toContain("fake-refresh")
      expect(stored).not.toContain("fake-secret")
    }

    // Disconnect: revoked at Google, gone from disk, and locked again.
    await page.evaluate(() => window.api.youtube.disconnect())
    expect(google.state.revoked.join()).toContain("token=fake-refresh")
    expect(fs.existsSync(path.join(data, "credentials", "youtube-oauthToken.enc"))).toBe(false)
    expect(fs.existsSync(path.join(data, "youtube-account.json"))).toBe(false)
    await expect(page.getByText("From your YouTube")).toBeHidden()
    await close(app)
    google.close()
  })

  test("denying access at Google is a clear outcome, and everything else still works", async () => {
    const google = await startFakeGoogle({ deny: true })
    const { app, page } = await launch({ google })
    await skipOnboarding(page)
    await page.evaluate((id) => window.api.youtube.setClient({ clientId: id, clientSecret: "s" }), CLIENT_ID)
    await page.getByRole("button", { name: "YouTube", exact: true }).first().click()
    await page.getByText("Other options").click()
    await page.getByRole("button", { name: "Connect Google" }).click()
    await page.getByRole("button", { name: "Continue to Google" }).click()
    await expect(page.getByText("Nothing was connected", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
    await shot(page, "16-denied")
    expect(await page.evaluate(() => window.api.youtube.access())).toMatchObject({ data: { connected: false } })
    await close(app)
    google.close()
  })
})
