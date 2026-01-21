import { usePlayerStore } from "@/stores/usePlayerStore";
import { useEffect, useRef } from "react";

const MusicRefsAndTitle = () => {

  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volume = usePlayerStore((f) => f.musicVolume);
  const paused = usePlayerStore((f) => f.paused);
  const looping = usePlayerStore((f) => f.looping)
  const setProgress = usePlayerStore((f) => f.setMusicProgress);
  const setAudioRef = usePlayerStore((f) => f.setAudioRef);
  const playingPlaylist = usePlayerStore((f) => f.playingPlaylist)
  const setCurrentlyPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const setPaused = usePlayerStore((f) => f.setPaused)


  useEffect(() => {
    if (!currentlyPlaying) {
      setAudioRef(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const fileUrl = `file://${currentlyPlaying.path}`;
    const audioEl = new Audio(fileUrl);
    audioEl.volume = volume / 100;

    audioEl
      .play()
      .then(() => console.log("Playing:", currentlyPlaying.name))
      .catch((err) => {
        console.warn("Autoplay blocked or failed:", err.message);
      });

    audioRef.current = audioEl;
    setAudioRef(audioEl);

    return () => {
      audioEl.pause();
      audioEl.currentTime = 0;
      setAudioRef(null);
    };
  }, [currentlyPlaying, setAudioRef]);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const handleTimeUpdate = () => {
      const ct = audioEl.currentTime;
      const duration = audioEl.duration;

      if (duration && !isNaN(duration) && duration > 0) {
        const progressPercent = (ct / duration) * 100;
        setProgress(progressPercent);
      }
    };

    audioEl.addEventListener("timeupdate", handleTimeUpdate);
    handleTimeUpdate();

    return () => {
      audioEl.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [currentlyPlaying, setProgress]);

  useEffect(() => {
    if (audioRef.current) {
      if (paused) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch((err) => {
          console.warn("Play failed:", err.message);
        });
      }
    }
  }, [paused]);


  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const handleEnded = () => {
      if (playingPlaylist?.songs && currentlyPlaying) {
        const currentIndex = playingPlaylist.songs.indexOf(currentlyPlaying);
        const nextSong = playingPlaylist.songs[currentIndex + 1];

        const firstSong = playingPlaylist.songs[0];
        if (nextSong && looping !== "loopSong") {
          setCurrentlyPlaying(nextSong);
          setPaused(false);
          return
        } if (looping === "loopPlaylist" && firstSong) {
          setPaused(false);
          setCurrentlyPlaying(firstSong);
          return
        } if (looping === "loopSong") {
          setPaused(false);
          if (
            audioRef.current
          ) {
            console.log("setting to 0 and then playing")
            audioRef.current.currentTime = 0
            audioRef.current.play()
          }
          return
        }

        setPaused(true)
        if (audioRef?.current) {
          audioRef.current.currentTime = 0
          setProgress(0)
        }
      }
    };

    audioEl.addEventListener("ended", handleEnded);

    return () => {
      audioEl.removeEventListener("ended", handleEnded);
    };
  }, [currentlyPlaying, playingPlaylist, looping, setCurrentlyPlaying, setPaused]);
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  if (!currentlyPlaying) {
    return null
  }

  const cleanedFileName = currentlyPlaying.name?.replace(".mp3", "");





  return (
    <div className="select-none flex justify-start truncate">
      {cleanedFileName}
    </div>
  )
}

export default MusicRefsAndTitle
