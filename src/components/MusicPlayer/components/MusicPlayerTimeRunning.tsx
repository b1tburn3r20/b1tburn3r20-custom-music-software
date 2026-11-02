import { usePlaybackClock } from "@/stores/usePlayerStore"
import { formatDuration } from "@/utils/textUtils"

const MusicPlayerTimeRunning = ({ className = "" }: { className?: string }) => {
  const time = usePlaybackClock((s) => s.time)
  const duration = usePlaybackClock((s) => s.duration)
  return (
    <div className={`flex items-center gap-1 text-muted-foreground tabular-nums ${className}`}>
      <span>{formatDuration(time)}</span>
      <span className="opacity-60">/</span>
      <span className="opacity-60">{formatDuration(duration)}</span>
    </div>
  )
}

export default MusicPlayerTimeRunning
