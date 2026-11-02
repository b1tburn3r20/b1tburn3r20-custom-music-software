import { useEffect } from "react"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Music } from "lucide-react"
import MusicQueue from "@/SecondVersion/components/MusicQueue"
import { useAppStore } from "@/stores/useAppStore"
import MusicPlayerTimeRunning from "./MusicPlayer/components/MusicPlayerTimeRunning"
import { togglePlay } from "@/player/controls"

const LaxPlayer = () => {
  const expanded = useSettingsStore((f) => f.playerExpanded)
  const activeSong = usePlayerStore((f) => f.currentlyPlaying)
  const isIdle = useAppStore((f) => f.idle)
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
  return (
    <div
      className={`absolute w-screen h-screen top-0 inset-x-0 transition-transform duration-500 ease-in-out z-10 ${expanded ? "-translate-y-0" : "translate-y-full"} ${isIdle ? 'cursor-none' : ''}`}
    >
      <div
        className="flex flex-col h-screen w-screen overflow-hidden relative transition-all duration-[3000ms] ease-in-out inset-shadow-black"
        onDoubleClick={(e) => handleDoubleClick(e)}
        style={backgroundStyle}
      >
        <div
          className={`absolute inset-0 backdrop-blur-[200px] transition-opacity duration-[3000ms] z-[11] ${activeSong?.metadata?.thumbnail ? 'opacity-100' : 'opacity-0'}`}
        />
        <div className="z-[12] absolute flex-col gap-2  inset-0 flex items-center justify-center -translate-y-10">
          {activeSong?.metadata?.thumbnail ? (
            <div
              className="cursor-pointer shrink-0 w-fit mb-2 select-none"
              onClick={() => handlePause()}
            >
              <img
                className="shrink-0 w-[600px] h-[600px] object-cover shadow-xl rounded-sm"
                src={activeSong.metadata.thumbnail}
                alt="Album art"
              />
            </div>
          ) : (
            <div className="p-1 bg-white/10 rounded-lg flex flex-col justify-center items-center">
              <Music className="text-primary h-10 w-10 bg-secondary rounded-lg p-1" />
            </div>
          )}
          <p className="select-none font-extrabold text-2xl">{activeSong?.metadata.title}</p>

          <div className="px-2 py-1 rounded-3xl bg-black/20 backdrop-blur-md">
            <p className="select-none font-normal text-white/80 text-lg">
              {activeSong?.metadata.artist}  {activeSong?.metadata?.album && activeSong?.metadata?.album !== "Unknown Album" ? `- ${activeSong.metadata.album} (${activeSong?.metadata?.year})` : ""}
            </p>
          </div>

          <div className={`transition-all pointer-events-none select-none duration-1000 ease-in-out ${isIdle ? 'opacity-100' : 'opacity-0'}`}>

            <div className="bg-muted/10 py-1 px-2 rounded-3xl backdrop-blur-md">
              <MusicPlayerTimeRunning className="text-white text-lg font-semibold" />
            </div>


          </div>


        </div>
        <div className="flex flex-end w-full justify-end">
          <div
            data-queue
            className={`z-[13] w-fit transition-transform duration-1000 ease-in-out ${isIdle ? 'translate-x-full' : 'translate-x-0'}`}
          >
            <MusicQueue />
          </div>
        </div>
      </div>
    </div>
  )
}

export default LaxPlayer
