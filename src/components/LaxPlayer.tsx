import { useEffect } from "react"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Music } from "lucide-react"
import MusicQueue from "@/SecondVersion/components/MusicQueue"
import { useAppStore } from "@/stores/useAppStore"
import MusicPlayerTimeRunning from "./MusicPlayer/components/MusicPlayerTimeRunning"

const LaxPlayer = () => {
  const expanded = useSettingsStore((f) => f.playerExpanded)
  const activeSong = usePlayerStore((f) => f.currentlyPlaying)
  const setPaused = usePlayerStore((f) => f.setPaused)
  const paused = usePlayerStore((f) => f.paused)
  const isIdle = useAppStore((f) => f.idle)
  const setIsIdle = useAppStore((f) => f.setIdle)
  const setExpanded = useSettingsStore((f) => f.setPlayerExpanded)
  const backgroundStyle = activeSong?.metadata?.thumbnail
    ? {
      backgroundImage: `url(${activeSong.metadata.thumbnail})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
    : {};

  useEffect(() => {
    let timeout: any;
    const handleMouseMove = () => {
      setIsIdle(false)
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        if (expanded) {
          setIsIdle(true)
        }
      }, 3000)
    }
    timeout = setTimeout(() => {
      if (expanded) {

        setIsIdle(true)
      }
    }, 3000)

    document.addEventListener('mousemove', handleMouseMove)
    return () => {
      clearTimeout(timeout)
      document.removeEventListener('mousemove', handleMouseMove)
    }
  }, [expanded])

  const handlePause = () => {
    if (paused) {
      setPaused(false)
    } else {
      setPaused(true)
    }
  }
  const handleDoubleClick = (e: any) => {
    const tag = e.target?.tagName;
    if ((e.target as HTMLElement)?.closest('[data-queue]')) return
    if (!["SPAN", "BUTTON", "IMG"].includes(tag)) {
      setExpanded(!expanded)
    }

  }
  return (
    <div
      className={`absolute w-screen h-screen bg-background top-0 inset-x-0 transition-transform duration-500 ease-in-out z-10 ${expanded ? "-translate-y-0" : "translate-y-full"} ${isIdle ? 'cursor-none' : ''}`}
    >
      <div
        className="flex flex-col h-screen w-screen overflow-hidden relative bg-background transition-all duration-[3000ms] ease-in-out inset-shadow-black"
        onDoubleClick={(e) => handleDoubleClick(e)}
        style={backgroundStyle}
      >
        <div
          className={`absolute inset-0 backdrop-blur-[200px] transition-opacity duration-[3000ms] z-[11] ${activeSong?.metadata?.thumbnail ? 'opacity-100' : 'opacity-0'}`}
        />
        <div className="z-[12] absolute flex-col gap-2 inset-0 flex items-center justify-center -translate-y-10">
          {activeSong?.metadata?.thumbnail ? (
            <div
              className="bg-white/10 p-1 rounded-lg shrink-0 w-fit select-none"
              onClick={() => handlePause()}
            >
              <img
                className="shrink-0 w-[600px] h-[600px] object-cover rounded-lg"
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
          <div className="p-2 rounded-3xl bg-muted/10 backdrop-blur-md">
            <p className="select-none font-normal text-white/40 text-lg">
              {activeSong?.metadata.artist} {activeSong?.metadata?.year ? `(${activeSong.metadata.year})` : ""}
            </p>
          </div>

          <div className={`transition-all pointer-events-none select-none duration-1000 ease-in-out ${isIdle ? 'opacity-100' : 'opacity-0'}`}>

            <div className="bg-muted/10 p-2 rounded-3xl backdrop-blur-md">
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
