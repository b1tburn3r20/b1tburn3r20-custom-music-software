import { usePlaybackClock, usePlayerStore } from "@/stores/usePlayerStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { next, setRepeat } from "@/player/controls"
import * as Q from "@/player/queue"
import { Loader2, SkipForward, Repeat, Repeat1 } from "lucide-react"
import { Artwork } from "@/components/base/Artwork"
import { Button } from "@/components/ui/button"

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
    <div role="status" aria-live="polite" className={`absolute right-0 top-0 z-toast transition-transform duration-slow ease-standard ${shouldShow ? "translate-x-0" : "translate-x-[calc(100%+var(--spacing)*5)]"}`}>
      <div className="min-w-toast rounded-bl-3xl border border-border/40 bg-popover/90 p-4 text-popover-foreground backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <Artwork src={nextSong?.metadata.thumbnail} size="sm" />
          <div className="flex-1">
            <div className="mb-1 text-xs text-muted-foreground">{willLoop ? "Playing again" : "Up next"}</div>
            <div className="line-clamp-1 text-sm font-medium">{nextSong?.metadata.title || "End of queue"}</div>
            {nextSong?.metadata.artist && <div className="line-clamp-1 text-xs text-muted-foreground">{nextSong.metadata.artist}</div>}
          </div>
          <div className="relative flex items-center justify-center">
            <span className="absolute mt-1 font-mono text-sm font-bold">{timeLeft !== null && timeLeft < 8 ? timeLeft.toFixed(0) : "0"}</span>
            <Loader2 className="size-12 animate-spin text-muted-foreground/50" aria-hidden />
          </div>
        </div>
        {(nextSong || showDisableLoop) && (
          <div className="mt-3 flex gap-2 border-t border-border/40 pt-3">
            {nextSong && (
              <Button variant="secondary" size="sm" className="flex-1 rounded-xl" onClick={next}>
                <SkipForward /> Skip now
              </Button>
            )}
            {showDisableLoop && (
              <Button variant="secondary" size="sm" className="flex-1 rounded-xl" onClick={() => setRepeat("off")}>
                {queue.repeat === "one" ? <Repeat1 /> : <Repeat />} Turn off repeat
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default LaxPlayerNextUp
