import { useState } from 'react';
import { Check, Loader2, Plus, Play, Youtube, Pause } from 'lucide-react';
import type { YoutubeDetailsResult } from '@/types/YoutubeTypes';
import type { FolderDetails, Song } from '@/types/DirectoryTypes';
import { useDirectoryStore } from '@/stores/useDirectoryStore';
import { useMusicStore, type CacheSongType } from '@/stores/useMusicStore';
import { usePlayerStore } from '@/stores/usePlayerStore';

import { startNewQueue } from "@/utils/musicutils"
const YoutubeVideoResult = ({
  result,
  currentDir
}: {
  result: YoutubeDetailsResult;
  currentDir: FolderDetails | null;
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showEmbed, setShowEmbed] = useState(false);
  const setCurrentDir = useDirectoryStore((f) => f.setCurrentDir);
  const setRecentlyDownloaded = useMusicStore((f) => f.setRecentlyDownloaded)
  const recentlyDownloaded = useMusicStore((f) => f.recentlyDownloaded)
  const songCache = useMusicStore((f) => f.songCache)
  const setPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const setPaused = usePlayerStore((f) => f.setPaused)
  const LS_KEY = "userRecentlyDownloaded"
  const playing = usePlayerStore((f) => f.currentlyPlaying)
  const paused = usePlayerStore((f) => f.paused)
  const songSame = songCache.find((s) => s.title === result.title)
  const artistSame = songCache.some((s) =>
    result.channel.toLowerCase().includes(s.artist.toLowerCase())
  );
  const addSongToCache = useMusicStore((f) => f.addSongToCache)



  const addRecentlyDownloaded = (song: Song) => {
    const filtered = recentlyDownloaded.filter((s) => s.name !== song.name || s.folderPath !== song.folderPath)
    const newRecPlayed = [song, ...filtered]
    setRecentlyDownloaded(newRecPlayed)
    localStorage.setItem(LS_KEY, JSON.stringify(newRecPlayed))
  }
  const isPlaying = songSame?.title?.toLowerCase() === playing?.metadata?.title?.toLowerCase() && songSame?.artist?.toLowerCase() === playing?.metadata?.artist?.toLowerCase()

  const handleAddToCache = (song: Song) => {
    const body: CacheSongType = {
      title: song.metadata.title ?? "",
      artist: song.metadata.artist ?? "",
      thumbnail: song.metadata.thumbnail ?? "",
      path: song.path
    }
    addSongToCache(body)
  }

  const handleDownload = async () => {
    if (!currentDir) {
      setError('Please select a folder first');
      return;
    }
    setDownloading(true);
    setError(null);

    let cleanup = null;
    try {
      cleanup = (window as any).electron.onDownloadProgress((data) => {
        if (data.videoId === result.id) {
          setProgress(parseFloat(data.percent));
        }
      });

      const response = await (window as any).electron.downloadYoutube({
        videoId: result.id,
        title: result.title,
        savePath: currentDir
      });
      if (!response.error) {
        addRecentlyDownloaded(response)
        handleAddToCache(response)
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError(err.toString() || 'Failed to download video');
    } finally {
      if (cleanup) cleanup();
      setDownloading(false);
    }
  };

  const getStyles = () => {
    if (songSame && artistSame) {
      return "text-emerald-500"
    } else if (songSame) {
      return "text-red-500"
    } else if (artistSame) {
      return "text-amber-500"
    } else {
      return ""
    }
  }

  const getButton = () => {
    if (songSame && artistSame) {
      return (
        <div className='cursor-pointer rounded-t-none rounded-b-3xl w-full '>
          <PlayButton />
        </div>
      )
    } else if (songSame) {
      return (
        <div className='cursor-pointer rounded-t-none rounded-b-3xl flex items-center w-full'>
          <PlayButton />
          <DownloadButton />
        </div>
      )

    } else {
      return (
        <div className='cursor-pointer rounded-t-none rounded-b-3xl w-full bg-muted'>
          <DownloadButton />
        </div>
      )
    }




  }

  const handlePlay = async (song: CacheSongType) => {
    if (isPlaying && !paused) {
      setPaused(true)
      return
    } else if (isPlaying && paused) {
      setPaused(false)
      return
    }
    const body = {
      rootDir: currentDir,
      path: song.path,
      forceRefresh: false,
    }
    const response: any = await (window as any).electron.getSongByPath(body)
    if (response.song) {
      startNewQueue(currentDir, response.song.path)
      setPaused(false)
    }
  }


  const getPlayButtonContent = () => {
    if (!isPlaying) {
      return (
        <div className='text-center w-full justify-center flex gap-1 items-center text-xs'>
          <Play className="w-4 h-4 text-primary" />
          <span className="">Play</span>
        </div>


      )
    } else if (isPlaying && !paused) {
      return (
        <div className='text-center animate-pulse w-full justify-center flex gap-1 items-center text-xs'>
          <Pause className="w-4 h-4 text-primary" />
          <span className="">Playing</span>
        </div>
      )
    } else {
      return (
        <div className='text-center w-full animate-pulse justify-center flex gap-1 items-center text-xs'>
          <Play className="w-4 h-4 text-primary" />
          <span className=" ">Paused...</span>
        </div>

      )
    }
  }

  const PlayButton = () => {
    if (!songSame) {
      return null
    }
    return (
      <button
        onClick={() => handlePlay(songSame)}
        className='w-full bg-muted text-xs hover:bg-muted/50 rounded-b-3xl cursor-pointer justify-center items-center flex gap-2 p-2 text-center'
        disabled={downloading || downloaded}
      >
        {downloading ? (
          <div>
            {/* <Slider */}
            {/*   value={[progress]} */}
            {/*   onValueChange={(value) => setProgress(value[0])} */}
            {/*   max={100} */}
            {/*   step={1} */}
            {/*   className="w-full rounded-none h-12" */}
            {/* /> */}
            <span className=' text-muted-foreground'>{progress}% downloaded...</span>
          </div>
        ) : downloaded ? (
          <div className='text-center w-full justify-center flex gap-1 items-center '>
            <Check className="w-4 h-4" />
            <span className="">Saved!</span>
          </div>
        ) : (
          <>
            {getPlayButtonContent()}
          </>
        )}
      </button>

    )
  }


  const DownloadButton = () => {
    return (
      <button
        onClick={handleDownload}
        className='w-full text-xs cursor-pointer justify-center bg-muted hover:bg-muted/50 rounded-b-3xl items-center flex gap-2 p-2 text-center'
        disabled={downloading || downloaded}
      >
        {downloading ? (
          <div>
            {/* <Slider */}
            {/*   value={[progress]} */}
            {/*   onValueChange={(value) => setProgress(value[0])} */}
            {/*   max={100} */}
            {/*   step={1} */}
            {/*   className="w-full rounded-none h-12" */}
            {/* /> */}
            <span className='text-muted-foreground'>{progress}% downloaded...</span>
          </div>
        ) : downloaded ? (
          <div className='text-center w-full justify-center flex gap-1 items-center '>
            <Check className="w-4 h-4" />
            <span className="">Saved!</span>
          </div>
        ) : (
          <div className='text-center w-full justify-center flex gap-1 items-center '>
            <Youtube className="w-4 text-red-500 h-4" />
            <span className="">Get</span>
          </div>

        )}
      </button>

    )
  }



  if (result?.lengthSeconds < 70) {
    return null;
  }



  return (
    <div className="bg-secondary/50 flex flex-col p-2 justify-start items-center rounded-3xl w-[260px]">
      <div title={result.title} className="p-3 max-w-full self-start">
        <div className={`text-xs font-semibold flex flex-col ${getStyles()}`}>
          <span className='line-clamp-2'>

            {result.title}
          </span>
          <span className='text-muted-foreground'>

            {result.channel}
          </span>
        </div>

      </div>
      <div className="relative flex w-full justify-center items-center">
        {showEmbed && result.embeddable ? (
          <iframe
            className="rounded-t-3xl"
            width={240}
            height={180}
            src={`https://www.youtube.com/embed/${result.id}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />) : (
          <>
            <img
              className="rounded-t-3xl"
              width={240}
              height={240}
              src={result.thumbnail}
              alt={result.title}
            />
            {result.embeddable && (
              <button
                onClick={() => setShowEmbed(true)}
                className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 rounded-t-3xl transition-colors group"
              >
                <div className="bg-red-500/80 rounded-full p-3 group-hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 text-muted" />
                </div>
              </button>
            )}
          </>
        )}
      </div>
      <div className="w-[240px] mx-2 rounded-b-3xl">
        <div className="flex items-center bg-muted rounded-3xl">
          {getButton()}
        </div>
        {error && (
          <div className="mt-2 text-xs text-red-500">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default YoutubeVideoResult;
