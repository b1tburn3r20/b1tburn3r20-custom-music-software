import { useMusicStore } from "@/stores/useMusicStore";
import { usePlayerStore } from "@/stores/usePlayerStore"
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { Song } from "@/types/DirectoryTypes";
import { Loader2, SkipForward, Repeat, Repeat1, Music } from "lucide-react";
import { useEffect, useState } from "react";

const LaxPlayerNextUp = () => {
  const audioRef = usePlayerStore((f) => f.audioRef)
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying);
  const [shouldShow, setShouldShow] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const queue = useMusicStore((f) => f.queue)
  const setCurrentlyPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const setPaused = usePlayerStore((f) => f.setPaused)
  const looping = usePlayerStore((f) => f.looping)
  const setLooping = usePlayerStore((f) => f.setLooping)
  const isExpanded = useSettingsStore((f) => f.playerExpanded)

  const [nextSong, setNextSong] = useState<Song | null>(null);
  const [willLoop, setWillLoop] = useState(false);

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

  useEffect(() => {
    if (timeLeft === 0) {
      setShouldShow(false)
    }
    else if (timeLeft !== null && timeLeft < 7 && timeLeft > 0) {
      setShouldShow(true)
    } else if (timeLeft !== null && timeLeft >= 7) {
      setShouldShow(false)
    }
    checkIfShouldShow()
  }, [timeLeft])

  const checkIfShouldShow = () => {
    if (!isExpanded) {
      setShouldShow(false)
    } else if (isExpanded && timeLeft !== null && timeLeft < 7 && timeLeft > 0) {
      setShouldShow(true)
    }

  }


  useEffect(() => {
    checkIfShouldShow()
  }, [isExpanded])

  useEffect(() => {

    if (queue && currentlyPlaying) {
      const currentIndex = queue.indexOf(currentlyPlaying);
      const next = queue[currentIndex + 1];
      const first = queue[0];

      if (looping === "loopSong") {
        setNextSong(currentlyPlaying);
        setWillLoop(true);
      } else if (next) {
        setNextSong(next);
        setWillLoop(false);
      } else if (looping === "loopPlaylist" && currentIndex === queue.length - 1) {
        setNextSong(first);
        setWillLoop(true);
      } else {
        setNextSong(null);
        setWillLoop(false);
      }
    }
  }, [queue, currentlyPlaying, looping]);

  const handleSkipNow = () => {
    if (queue && currentlyPlaying) {
      const currentIndex = queue.indexOf(currentlyPlaying);
      const next = queue[currentIndex + 1];
      const first = queue[0];

      if (next && looping !== "loopSong") {
        setCurrentlyPlaying(next);
        setPaused(false);
      } else if (looping === "loopPlaylist" && first) {
        setCurrentlyPlaying(first);
        setPaused(false);
      } else if (looping === "loopSong" && audioRef) {
        audioRef.currentTime = 0;
        audioRef.play();
        setPaused(false);
      }
    }
  };

  const handleDisableLoop = () => {
    setLooping("noLoop");
  };

  const canSkip = nextSong !== null;
  const showDisableLoop = looping === "loopSong" || looping === "loopPlaylist";

  return (
    <div className={`absolute z-40 top-0 right-0 duration-500 ease-in-out transition-transform  ${shouldShow ? "translate-x-0" : "translate-x-[calc(100%+1.25rem)]"}`}>
      <div className="bg-black/80 backdrop-blur-sm p-4 text-white min-w-[300px] border border-white/10  rounded-bl-4xl " >
        <div className="flex items-center justify-between gap-4">
          <div>
            <>
              {nextSong?.metadata?.thumbnail ? (
                <div className="bg-white/10 p-1 rounded-lg shrink-0">
                  <img
                    className="shrink-0 w-10 h-10 object-cover rounded-lg"
                    src={nextSong.metadata.thumbnail}
                    alt="Album art"
                  />
                </div>
              ) : (
                <div className="p-1 bg-white/10 rounded-lg flex flex-col justify-center items-center">
                  <Music className="text-primary h-10 w-10 bg-secondary rounded-lg p-1" />
                </div>
              )}
            </>
          </div>
          <div className="flex-1">
            <div className="text-xs text-white/60 mb-1">
              {willLoop ? "Playing again" : "Up next"}
            </div>
            <div className="text-sm font-medium line-clamp-1">
              {nextSong?.metadata?.title || nextSong?.name || "End of playlist"}
            </div>
            {nextSong?.metadata?.artist && (
              <div className="text-xs text-white/60 line-clamp-1">
                {nextSong.metadata.artist}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span className="absolute text-sm font-bold font-mono mt-1">
                {timeLeft !== null && timeLeft < 8 ? timeLeft.toFixed(0) : '0'}
              </span>
              <Loader2 className="animate-spin text-white/40" size={48} />
            </div>
          </div>
        </div>

        {(canSkip || showDisableLoop) && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
            {canSkip && (
              <button
                onClick={handleSkipNow}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs transition-colors"
              >
                <SkipForward size={14} />
                Skip Now
              </button>
            )}
            {showDisableLoop && (
              <button
                onClick={handleDisableLoop}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs transition-colors"
              >
                {looping === "loopSong" ? <Repeat1 size={14} /> : <Repeat size={14} />}
                Disable Loop
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default LaxPlayerNextUp
