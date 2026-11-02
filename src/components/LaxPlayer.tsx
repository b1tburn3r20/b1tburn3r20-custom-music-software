import { useEffect } from "react"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Artwork } from "@/components/base/Artwork"
import MusicQueue from "@/components/Music/MusicQueue"
import { useAppStore } from "@/stores/useAppStore"
import MusicPlayerTimeRunning from "./MusicPlayer/components/MusicPlayerTimeRunning"
import { togglePlay } from "@/player/controls"

const LaxPlayer = () => {
  const expanded = useSettingsStore((f) => f.playerExpanded)
  const activeSong = usePlayerStore((f) => f.currentlyPlaying)
  const isIdle = useAppStore((f) => f.idle)
  const paused = usePlayerStore((s) => s.paused)
  const setIsIdle = useAppStore((f) => f.setIdle)
  const setExpanded = useSettingsStore((f) => f.setPlayerExpanded)
  const zenEnabled = useSettingsStore((f) => f.laxPlayerAutoHide)
  const zenTimeout = useSettingsStore((f) => f.zenModeTimeout)
  const backgroundStyle = activeSong?.metadata?.thumbnail
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

    document.addEventListener('mousemove', handleMouseMove)
    return () => {
      clearTimeout(timeout)
      document.removeEventListener('mousemove', handleMouseMove)
    }
  }, [expanded, zenEnabled, zenTimeout, setIsIdle])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && expanded && !document.querySelector("[role=dialog],[role=menu]")) setExpanded(false)
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
      className={`absolute inset-x-0 top-0 z-zen h-screen w-screen transition-transform duration-slow ease-standard ${expanded ? "translate-y-0" : "translate-y-full"} ${isIdle ? "cursor-none" : ""}`}
    >
      <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-background transition-all duration-ambient" onDoubleClick={handleDoubleClick} style={backgroundStyle}>
        <div className={`absolute inset-0 bg-background/40 backdrop-blur-ambient transition-opacity duration-ambient ${m?.thumbnail ? "opacity-100" : "opacity-0"}`} />
        <div className="absolute inset-0 z-zen-art flex -translate-y-10 flex-col items-center justify-center gap-2">
          <button type="button" aria-label={paused ? "Play" : "Pause"} className="mb-2 shrink-0 select-none" onClick={handlePause}>
            <Artwork src={m?.thumbnail} size="hero" className="shadow-xl" />
          </button>
          <p className="select-none text-2xl font-extrabold">{m?.title}</p>
          <div className="rounded-full bg-background/30 px-3 py-1 backdrop-blur-md">
            <p className="select-none text-lg text-foreground/80">
              {m?.artist}
              {m?.album ? ` · ${m.album}${m.year ? ` (${m.year})` : ""}` : ""}
            </p>
          </div>
          <div className={`pointer-events-none select-none transition-opacity duration-gentle ${isIdle ? "opacity-100" : "opacity-0"}`}>
            <div className="rounded-full bg-background/30 px-3 py-1 backdrop-blur-md">
              <MusicPlayerTimeRunning className="text-lg font-semibold text-foreground" />
            </div>
          </div>
        </div>
        <div className="flex w-full justify-end">
          <div data-queue className={`z-zen-queue w-fit transition-transform duration-gentle ease-standard ${isIdle ? "translate-x-full" : "translate-x-0"}`}>
            <MusicQueue />
          </div>
        </div>
      </div>
    </div>
  )
}

export default LaxPlayer
