
import { fancyTimeFormat } from "@/components/helpers/stringfuncs";
import { usePlayerStore } from "@/stores/usePlayerStore"
import { formatDuration } from "@/utils/textUtils";
import { useEffect, useState } from "react";
interface MusicPlayerTimeRunningProps {
  className?: string
}
const MusicPlayerTimeRunning = ({ className }: MusicPlayerTimeRunningProps) => {
  const audioRef = usePlayerStore((f) => f.audioRef)
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying);
  const [timeLeft, setTimeLeft] = useState<number | null>(null)


  useEffect(() => {
    if (!audioRef) return;
    const handleTimeUpdate = () => {
      const ct = audioRef.currentTime;
      const duration = audioRef.duration;
      if (duration && !isNaN(duration) && duration > 0) {
        const tl = duration - ct;
        setTimeLeft(tl);
      }
    };
    audioRef.addEventListener("timeupdate", handleTimeUpdate);
    handleTimeUpdate();
    return () => {
      audioRef.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [currentlyPlaying, audioRef]);







  return (
    <div className={`flex items-center gap-1 text-muted-foreground ${className}`}>
      <span> {fancyTimeFormat((audioRef?.duration || 0) - (timeLeft || 0))} </span> <span className="text-muted-foreground">/</span> <span className="text-muted-foreground">{formatDuration(audioRef?.duration || 0)} </span>
    </div>
  )
}

export default MusicPlayerTimeRunning
