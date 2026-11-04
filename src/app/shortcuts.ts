// App-wide keyboard shortcuts. Element-level keys (song rows, sliders, menus,
// dialogs) handle themselves first and stop/prevent the event, so this only
// sees keys nothing focused wanted.
import { toast } from "sonner"
import { cycleRepeat, next, prev, seek, seekBy, setVolume, toggleMute, togglePlay, toggleShuffle } from "@/player/controls"
import { usePlayerStore, usePlaybackClock } from "@/stores/usePlayerStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { useSelectionStore } from "@/stores/useSelectionStore"
import { useUserStore } from "@/stores/useUserStore"
import { dialogs } from "@/stores/useDialogStore"
import { navigate, useAppStore, type Route } from "@/stores/useAppStore"
import { openSettings } from "@/app/settings/settingsStore"
import { setLiked } from "@/lib/actions"

export type ShortcutGroup = { title: string; items: { keys: string[]; label: string }[] }

/** Shown in the "Keyboard shortcuts" dialog (?). Keep in sync with the handlers below and in the components. */
export const SHORTCUTS: ShortcutGroup[] = [
  {
    title: "Playback",
    items: [
      { keys: ["Space"], label: "Play / pause" },
      { keys: ["Ctrl", "→"], label: "Next song" },
      { keys: ["Ctrl", "←"], label: "Previous song" },
      { keys: ["←", "→"], label: "Seek 5 seconds (Shift: 15)" },
      { keys: ["0–9"], label: "Jump to 0–90% of the song" },
      { keys: ["Ctrl", "↑ / ↓"], label: "Volume up / down" },
      { keys: ["M"], label: "Mute / unmute" },
      { keys: ["S"], label: "Shuffle on / off" },
      { keys: ["R"], label: "Repeat: off → all → one" },
      { keys: ["L"], label: "Like / unlike the playing song" },
      { keys: ["T"], label: "Tag the playing song" },
    ],
  },
  {
    title: "Full-screen player",
    items: [
      { keys: ["F"], label: "Open / close the full-screen player" },
      { keys: ["Esc"], label: "Close it" },
      { keys: ["B"], label: "Artwork ↔ visualizer" },
      { keys: ["V"], label: "Next visualization" },
      { keys: ["Ctrl", "K"], label: "Search without leaving it (also /)" },
    ],
  },
  {
    title: "Songs",
    items: [
      { keys: ["↑ / ↓"], label: "Move between songs (Home / End: first / last)" },
      { keys: ["Enter"], label: "Play the focused song" },
      { keys: ["Shift", "↑ / ↓"], label: "Select several songs" },
      { keys: ["Q"], label: "Add the focused song to the queue" },
      { keys: ["N"], label: "Play it next" },
      { keys: ["L"], label: "Like / unlike it" },
      { keys: ["T"], label: "Tag it (or the selection)" },
      { keys: ["Shift", "F10"], label: "All actions (context menu)" },
      { keys: ["Esc"], label: "Clear the selection" },
    ],
  },
  {
    title: "Navigation",
    items: [
      { keys: ["Tab"], label: "Next control (Shift+Tab: previous)" },
      { keys: ["F6"], label: "Jump between sidebar, search, page and player" },
      { keys: ["Ctrl", "K"], label: "Search (also /)" },
      { keys: ["Alt", "← / →"], label: "Back / forward" },
      { keys: ["Ctrl", "1–7"], label: "Home, Library, YouTube, History, Downloads, Stats, Liked" },
      { keys: ["Ctrl", "N"], label: "New playlist" },
      { keys: ["Ctrl", ","], label: "Settings" },
      { keys: ["Ctrl", "/"], label: "Show / hide this list (also ?)" },
    ],
  },
]

const PAGES: Route[] = [{ name: "home" }, { name: "library" }, { name: "youtube" }, { name: "history" }, { name: "downloads" }, { name: "stats" }, { name: "liked" }]

const isTyping = (t: HTMLElement | null) => Boolean(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable))
const overlayOpen = () => Boolean(document.querySelector("[role=dialog],[role=menu],[role=alertdialog]"))
/** Keyboard-focused controls (not ones that merely kept focus after a mouse click) get Space/Enter. */
const keyboardFocusedControl = (t: HTMLElement | null) =>
  Boolean(t?.matches("button,a[href],[role=button],[role=link],[role=checkbox],[role=switch],[role=tab],[role=option],[role=slider],[role=radio]") && t.matches(":focus-visible"))

// ─── F6: cycle focus between the big regions ───────────────────────────────
const TABBABLE = 'button:not([disabled]),a[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
const visible = (el: Element) => !el.closest("[inert]") && (el as HTMLElement).getClientRects().length > 0

function focusRegion(dir: 1 | -1) {
  const regions = [...document.querySelectorAll<HTMLElement>("[data-region]")].filter(visible)
  if (!regions.length) return
  const cur = regions.findIndex((r) => r.contains(document.activeElement))
  const target = regions[(cur + dir + regions.length) % regions.length] ?? regions[0]
  const el =
    target.querySelector<HTMLElement>("[data-region-focus]") ??
    target.querySelector<HTMLElement>("[data-song-row][aria-current=true]") ??
    [...target.querySelectorAll<HTMLElement>(TABBABLE)].find(visible) ??
    null
  el?.focus()
  el?.scrollIntoView({ block: "nearest" })
}

function announce(msg: string) {
  toast(msg, { id: "shortcut", duration: 1200 })
}

function handled(e: KeyboardEvent, run: () => void) {
  e.preventDefault()
  run()
}

function onKeyDown(e: KeyboardEvent) {
  if (e.defaultPrevented) return
  const t = e.target as HTMLElement | null
  const ctrl = e.ctrlKey || e.metaKey
  const key = e.key

  // Ctrl+/ toggles the shortcuts overview from anywhere but a text field,
  // including from inside the overview itself (so the same keys close it).
  if (ctrl && !e.altKey && (key === "/" || e.code === "Slash") && !isTyping(t)) {
    const { shortcutsOpen, openShortcuts } = dialogs()
    if (shortcutsOpen) return handled(e, () => openShortcuts(false))
    if (!overlayOpen()) return handled(e, () => openShortcuts(true))
    return
  }
  // F6 works everywhere except inside dialogs/menus (they trap focus).
  if (key === "F6" && !overlayOpen()) {
    e.preventDefault()
    return focusRegion(e.shiftKey ? -1 : 1)
  }
  // Ctrl+K in the full-screen player opens its own search, and closes it again from inside.
  if (ctrl && !e.altKey && !e.shiftKey && key.toLowerCase() === "k" && useSettingsStore.getState().playerExpanded) {
    const { zenSearchOpen, openZenSearch } = dialogs()
    if (zenSearchOpen) return handled(e, () => openZenSearch(false))
    if (!overlayOpen()) return handled(e, () => openZenSearch(true))
    return
  }
  if (isTyping(t) || overlayOpen()) return

  // ── App-level (with modifiers) ──
  if (e.altKey && !ctrl) {
    if (key === "ArrowLeft") return handled(e, () => useAppStore.getState().goBack())
    if (key === "ArrowRight") return handled(e, () => useAppStore.getState().goForward())
    return
  }
  if (ctrl && !e.altKey) {
    if (/^[1-7]$/.test(key)) {
      e.preventDefault()
      useSettingsStore.getState().setPlayerExpanded(false)
      return navigate(PAGES[Number(key) - 1])
    }
    if (key === ",") return handled(e, () => openSettings())
    if (key.toLowerCase() === "n" && !e.shiftKey) return handled(e, () => dialogs().openPlaylistForm({ mode: "create" }))
    if (key === "ArrowRight" && !e.repeat) return handled(e, () => next())
    if (key === "ArrowLeft" && !e.repeat) return handled(e, () => prev())
    if (key === "ArrowUp" || key === "ArrowDown") {
      e.preventDefault()
      const v = Math.max(0, Math.min(100, usePlayerStore.getState().volume + (key === "ArrowUp" ? 5 : -5)))
      setVolume(v)
      return announce(`Volume ${Math.round(v)}%`)
    }
    return
  }

  // ── Single keys ──
  if (key === "?") return handled(e, () => dialogs().openShortcuts(true))
  if (key === "/") {
    e.preventDefault()
    if (useSettingsStore.getState().playerExpanded) return dialogs().openZenSearch(true)
    return document.getElementById("app-search")?.focus()
  }

  const player = usePlayerStore.getState()
  const song = player.currentlyPlaying
  if (key === " " || e.code === "Space") {
    if (keyboardFocusedControl(t) || e.repeat) return
    e.preventDefault()
    return togglePlay()
  }
  if (key === "ArrowLeft" || key === "ArrowRight") {
    // Arrows on a focused control (slider, tabs, …) are its own.
    if (!song || t?.closest("[role=slider],[role=tablist],[role=radiogroup],[role=listbox]")) return
    e.preventDefault()
    return seekBy((key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 15 : 5))
  }
  if (e.repeat || e.shiftKey) return
  if (/^[0-9]$/.test(key) && song) {
    const d = usePlaybackClock.getState().duration
    if (d > 0) seek((Number(key) / 10) * d)
    return
  }
  switch (key.toLowerCase()) {
    case "m":
      toggleMute()
      return announce(usePlayerStore.getState().volume > 0 ? "Unmuted" : "Muted")
    case "s":
      toggleShuffle()
      return announce(usePlayerStore.getState().queue.shuffle ? "Shuffle on" : "Shuffle off")
    case "r":
      cycleRepeat()
      return announce(`Repeat: ${usePlayerStore.getState().queue.repeat}`)
    case "f":
      if (!song) return
      return useSettingsStore.getState().setPlayerExpanded(!useSettingsStore.getState().playerExpanded)
    case "l": {
      if (!song) return
      const liked = !useUserStore.getState().likedIds.has(song.id)
      void setLiked(song.id, liked)
      return announce(liked ? "Added to Liked Songs" : "Removed from Liked Songs")
    }
    case "t":
      // With a multi-selection, T tags the selection (SelectionBar handles it).
      if (!song || useSelectionStore.getState().ids.size) return
      e.preventDefault()
      return dialogs().openTags([song])
  }
}

let installed = false
export function installShortcuts() {
  if (installed) return
  installed = true
  window.addEventListener("keydown", onKeyDown)
}
