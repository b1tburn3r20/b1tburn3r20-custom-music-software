import { useSettingsStore } from "@/stores/useSettingsStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Music } from "lucide-react"

const LaxPlayer = () => {
  const expanded = useSettingsStore((f) => f.playerExpanded)
  const activeSong = usePlayerStore((f) => f.currentlyPlaying)
  const backgroundStyle = activeSong?.metadata?.thumbnail
    ? {
      backgroundImage: `url(${activeSong.metadata.thumbnail})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
    : {};


  return (
    <div className={`absolute w-screen h-screen bg-background top-0 inset-x-0 transition-transform duration-500 ease-in-out z-10 ${expanded ? " -translate-y-0" : "translate-y-full"}`}
    >
      <div
        className="flex flex-col h-screen w-screen overflow-hidden relative bg-background transition-all duration-[3000ms] ease-in-out inset-shadow-black"
        style={backgroundStyle}

      >
        <div
          className={`absolute inset-0 backdrop-blur-[200px] pointer-events-none  transition-opacity duration-[3000ms]  z-[11] ${activeSong?.metadata?.thumbnail ? 'opacity-100' : 'opacity-0'
            }`}
        />
        <div className="z-[12] absolute flex flex-col gap-2  inset-0 flex items-center justify-center -translate-y-10">
          {activeSong?.metadata?.thumbnail ? (
            <div className="bg-white/10 p-1 rounded-lg shrink-0 w-fit">
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
          <p className="font-extrabold text-2xl">{activeSong?.metadata.title} </p>
          <p className="font-normal text-muted-foreground text-lg">{activeSong?.metadata.artist} </p>



        </div>
        <div className="z-[13]">

          {/* <LaxPlayerPlaylist /> */}
        </div>
      </div>
    </div>
  )
}

export default LaxPlayer
