import { usePlaybackClock, usePlayerStore } from "@/stores/usePlayerStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { next, setRepeat } from "@/player/controls"
import * as Q from "@/player/queue"
import { Loader2, SkipForward, Repeat, Repeat1, Music } from "lucide-react"

/** "Up next" card shown in the expanded player during the last seconds of a song. */
const LaxPlayerNextUp = () => {
  const time = usePlaybackClock((s) => s.time)
  const duration = usePlaybackClock((s) => s.duration)
  const queue = usePlayerStore((s) => s.queue)
  const current = usePlayerStore((s) => s.currentlyPlaying)
  const isExpanded = useSettingsStore((f) => f.playerExpanded)
  const songsById = useLibraryStore((s) => s.songsById)

  const timeLeft = duration > 0 ? duration - time : null
  const shouldShow = isExpanded && timeLeft !== null && timeLeft > 0 && timeLeft < 7

  let nextSong = null
  let willLoop = false
  if (current) {
    if (queue.repeat === "one") {
      nextSong = current
      willLoop = true
    } else {
      const upcoming = Q.upcoming(queue)
      if (upcoming[0]) nextSong = songsById[upcoming[0].songId] ?? null
      else if (queue.repeat === "all" && queue.order.length > 0) {
        nextSong = songsById[queue.items[queue.order[0]].songId] ?? null
        willLoop = true
      }
    }
  }
  const showDisableLoop = queue.repeat !== "off"

  return (
    <div className={`absolute z-40 top-0 right-0 duration-500 ease-in-out transition-transform ${shouldShow ? "translate-x-0" : "translate-x-[calc(100%+1.25rem)]"}`}>
      <div className="bg-black/80 backdrop-blur-sm p-4 text-white min-w-[300px] border border-white/10 rounded-bl-4xl">
        <div className="flex items-center justify-between gap-4">
          {nextSong?.metadata.thumbnail ? (
            <div className="bg-white/10 p-1 rounded-lg shrink-0">
              <img className="shrink-0 w-10 h-10 object-cover rounded-lg" src={nextSong.metadata.thumbnail} alt="" />
            </div>
          ) : (
            <div className="p-1 bg-white/10 rounded-lg flex flex-col justify-center items-center">
              <Music className="text-primary h-10 w-10 bg-secondary rounded-lg p-1" />
            </div>
          )}
          <div className="flex-1">
            <div className="text-xs text-white/60 mb-1">{willLoop ? "Playing again" : "Up next"}</div>
            <div className="text-sm font-medium line-clamp-1">{nextSong?.metadata.title || "End of queue"}</div>
            {nextSong?.metadata.artist && <div className="text-xs text-white/60 line-clamp-1">{nextSong.metadata.artist}</div>}
          </div>
          <div className="relative flex items-center justify-center">
            <span className="absolute text-sm font-bold font-mono mt-1">{timeLeft !== null && timeLeft < 8 ? timeLeft.toFixed(0) : "0"}</span>
            <Loader2 className="animate-spin text-white/40" size={48} />
          </div>
        </div>
        {(nextSong || showDisableLoop) && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
            {nextSong && (
              <button onClick={next} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs transition-colors">
                <SkipForward size={14} /> Skip now
              </button>
            )}
            {showDisableLoop && (
              <button onClick={() => setRepeat("off")} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs transition-colors">
                {queue.repeat === "one" ? <Repeat1 size={14} /> : <Repeat size={14} />} Turn off repeat
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default LaxPlayerNextUp
