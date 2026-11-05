import { useEffect, useMemo, useRef, useState } from "react"
import { AudioLines, ImageIcon, Sparkles } from "lucide-react"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Artwork } from "@/components/base/Artwork"
import MusicQueue from "@/components/Music/MusicQueue"
import { useAppStore } from "@/stores/useAppStore"
import MusicPlayerTimeRunning from "./MusicPlayer/components/MusicPlayerTimeRunning"
import { togglePlay } from "@/player/controls"
import { useUserStore } from "@/stores/useUserStore"
import { updateSettings } from "@/lib/actions"
import { Visualizer } from "@/components/visualizer/Visualizer"
import { SCENES, type SceneId } from "@/components/visualizer/scenes"

/** Same scene every time a given song plays in "cycle" mode, but different songs get different scenes. */
function sceneForSong(songId: string | undefined): SceneId {
  let h = 0
  for (const c of songId ?? "") h = (h * 31 + c.charCodeAt(0)) >>> 0
  return SCENES[h % SCENES.length].id
}

const LaxPlayer = () => {
  const expanded = useSettingsStore((f) => f.playerExpanded)
  const activeSong = usePlayerStore((f) => f.currentlyPlaying)
  const isIdle = useAppStore((f) => f.idle)
  const paused = usePlayerStore((s) => s.paused)
  const setIsIdle = useAppStore((f) => f.setIdle)
  const setExpanded = useSettingsStore((f) => f.setPlayerExpanded)
  const zenEnabled = useSettingsStore((f) => f.laxPlayerAutoHide)
  const zenTimeout = useSettingsStore((f) => f.zenModeTimeout)
  const background = useUserStore((s) => s.settings.playerBackground)
  const visualizerSetting = useUserStore((s) => s.settings.visualizer)
  const visualize = background === "visualizer"
  const scene: SceneId = useMemo(
    () => (SCENES.some((x) => x.id === visualizerSetting) ? (visualizerSetting as SceneId) : sceneForSong(activeSong?.id)),
    [visualizerSetting, activeSong?.id],
  )
  const [flash, setFlash] = useState<string | null>(null)
  const [bpm, setBpm] = useState<number | null>(null)
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 1400)
    return () => clearTimeout(t)
  }, [flash])
  // The label follows the *saved* settings, so it can never announce a change that didn't happen.
  const shown = useRef({ visualize, visualizerSetting })
  useEffect(() => {
    const prev = shown.current
    shown.current = { visualize, visualizerSetting }
    if (!expanded) return
    if (prev.visualize !== visualize) setFlash(visualize ? (SCENES.find((x) => x.id === scene)?.label ?? "Visualizer") : "Artwork")
    else if (visualize && prev.visualizerSetting !== visualizerSetting) setFlash(SCENES.find((x) => x.id === scene)?.label ?? null)
  }, [visualize, visualizerSetting, scene, expanded])
  const nextScene = () => {
    if (!visualize) return
    const i = SCENES.findIndex((x) => x.id === scene)
    void updateSettings({ visualizer: SCENES[(i + 1) % SCENES.length].id })
  }
  const toggleBackground = () => void updateSettings({ playerBackground: visualize ? "artwork" : "visualizer" })
  const keys = useRef({ nextScene, toggleBackground })
  keys.current = { nextScene, toggleBackground }

  const backgroundStyle = !visualize && activeSong?.metadata?.thumbnail
    ? {
      backgroundImage: `url("${encodeURI(activeSong.metadata.thumbnail)}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
    : {};



  useEffect(() => {
    if (!zenEnabled) {
      return
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const handleMouseMove = () => {
      setIsIdle(false)
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        if (expanded) {
          setIsIdle(true)
        }
      }, zenTimeout)
    }
    timeout = setTimeout(() => {
      if (expanded) {

        setIsIdle(true)
      }
    }, zenTimeout)

    // Tabbing counts as being here too, or the hidden queue could never be reached by keyboard.
    const handleTab = (e: KeyboardEvent) => {
      if (e.key === "Tab") handleMouseMove()
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('keydown', handleTab)
    return () => {
      clearTimeout(timeout)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('keydown', handleTab)
    }
  }, [expanded, zenEnabled, zenTimeout, setIsIdle])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // A dialog closing on this same Esc has already claimed it.
      if (e.defaultPrevented || !expanded || document.querySelector("[role=dialog],[role=menu]")) return
      if (e.key === "Escape") setExpanded(false)
      const typing = (e.target as HTMLElement)?.closest?.("input,textarea,[contenteditable=true]")
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return
      // V: next visualization · B: switch between artwork and visualizer
      if (e.key === "v" || e.key === "V") keys.current.nextScene()
      if (e.key === "b" || e.key === "B") keys.current.toggleBackground()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [expanded, setExpanded])





  const handlePause = togglePlay

  const handleDoubleClick = (e: React.MouseEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if ((e.target as HTMLElement)?.closest('[data-queue]')) return
    if (!["SPAN", "BUTTON", "IMG"].includes(tag)) {
      setExpanded(!expanded)
    }

  }
  const m = activeSong?.metadata
  return (
    <div
      aria-hidden={!expanded}
      inert={!expanded}
      data-region="zen"
      className={`absolute inset-x-0 top-0 z-zen h-screen w-screen transition-transform duration-slow ease-standard ${expanded ? "translate-y-0" : "translate-y-full"} ${isIdle ? "cursor-none" : ""}`}
    >
      <div className={`relative flex h-screen w-screen flex-col overflow-clip transition-all duration-ambient bg-background`} onDoubleClick={handleDoubleClick} style={backgroundStyle}>
        {visualize ? (
          // The track info sits on its own translucent panel, so no darkening overlay is needed.
          <Visualizer scene={scene} artwork={m?.thumbnail} colorKey={activeSong?.id ?? "visualizer"} active={expanded} onTempo={setBpm} />
        ) : (
          <div className={`absolute inset-0 bg-background/40 backdrop-blur-ambient transition-opacity duration-ambient ${m?.thumbnail ? "opacity-100" : "opacity-0"}`} />
        )}
        <div className={`absolute left-4 top-4 z-zen-queue flex gap-2 transition-opacity duration-gentle ${isIdle ? "pointer-events-none opacity-0" : "opacity-100"}`}>
          <button type="button" onClick={toggleBackground} title="Switch background (B)" className="flex items-center gap-2 rounded-full bg-background/30 px-3 py-1.5 text-sm text-foreground/90 backdrop-blur-md transition-colors hover:bg-background/50">
            {visualize ? <ImageIcon className="size-4" /> : <AudioLines className="size-4" />}
            {visualize ? "Show artwork" : "Visualizer"}
          </button>
          {visualize && (
            <button type="button" onClick={nextScene} title="Next visualization (V)" className="flex items-center gap-2 rounded-full bg-background/30 px-3 py-1.5 text-sm text-foreground/90 backdrop-blur-md transition-colors hover:bg-background/50">
              <Sparkles className="size-4" />
              {SCENES.find((x) => x.id === scene)?.label}
              {bpm && <span className="tabular-nums text-foreground/60">· {bpm} BPM</span>}
              {visualizerSetting === "cycle" && <span className="text-foreground/60">· changes each song</span>}
            </button>
          )}
        </div>
        {flash && (
          <div role="status" className="pointer-events-none absolute left-1/2 top-8 z-zen-queue -translate-x-1/2 rounded-full bg-background/40 px-4 py-1.5 text-sm font-semibold backdrop-blur-md">
            {flash}
          </div>
        )}
        {/* Visualizer mode: the visuals own the screen, track info sits in the corner (like the old desktop players). */}
        <div className={visualize ? "pointer-events-none absolute bottom-28 left-8 z-zen-art flex items-end gap-3 rounded-2xl bg-visualizer-card p-2.5 pr-5 text-on-visualizer backdrop-blur-[2px]" : "absolute inset-0 z-zen-art flex -translate-y-10 flex-col items-center justify-center gap-2"}>
          <button type="button" aria-label={paused ? "Play" : "Pause"} className={`shrink-0 select-none ${visualize ? "pointer-events-auto" : "mb-2"}`} onClick={handlePause}>
            <Artwork src={m?.thumbnail} size={visualize ? "card" : "hero"} className="shadow-xl" />
          </button>
          <div className={visualize ? "flex min-w-0 flex-col items-start gap-1 pb-1" : "contents"}>
          <p className={`select-none font-extrabold text-2xl`}>{m?.title}</p>
          {/* The card behind it already sets the text apart in visualizer mode. */}
          <div className={visualize ? "" : "rounded-full bg-background/30 px-3 py-1 backdrop-blur-md"}>
            <p className={`select-none ${visualize ? "text-base text-on-visualizer/80" : "text-lg text-foreground/80"}`}>
              {m?.artist}
              {m?.album ? ` · ${m.album}${m.year ? ` (${m.year})` : ""}` : ""}
            </p>
          </div>
          <div className={`pointer-events-none select-none transition-opacity duration-gentle ${isIdle ? "opacity-100" : "opacity-0"}`}>
            <div className={visualize ? "" : "rounded-full bg-background/30 px-3 py-1 backdrop-blur-md"}>
              <MusicPlayerTimeRunning className={visualize ? "text-base font-semibold text-on-visualizer" : "text-lg font-semibold text-foreground"} />
            </div>
          </div>
          </div>
        </div>
        <div className="flex w-full justify-end">
          <div data-queue inert={isIdle} className={`z-zen-queue w-fit transition-transform duration-gentle ease-standard ${isIdle ? "translate-x-full" : "translate-x-0"}`}>
            <MusicQueue />
          </div>
        </div>
      </div>
    </div>
  )
}

export default LaxPlayer
