import { Button } from "@/components/ui/button"
import { useMusicStore } from "@/stores/useMusicStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import type { Song } from "@/types/DirectoryTypes"
import type { YoutubeDetailsResult } from "@/types/YoutubeTypes"
import { extendQueue, startNewQueue } from "@/utils/musicutils"
import { formatDuration } from "@/utils/textUtils"
import { Check, Download, Loader2, Pause, Play, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface PlaylistSongItemProps {
  song: YoutubeDetailsResult
  index: number
  currentDir: any | null
  isDownloading: boolean
  isDownloaded: boolean
  onDownloadComplete: (song: Song) => void
}

const PlaylistSongItem = ({
  song,
  index,
  currentDir,
  isDownloading: globalIsDownloading,
  isDownloaded: globalIsDownloaded,
  onDownloadComplete
}: PlaylistSongItemProps) => {
  const [downloaded, setDownloaded] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const addSongToCache = useMusicStore((f) => f.addSongToCache)
  const songCache = useMusicStore((f) => f.songCache)
  const setPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const setPaused = usePlayerStore((f) => f.setPaused)
  const playing = usePlayerStore((f) => f.currentlyPlaying)
  const paused = usePlayerStore((f) => f.paused)


  const songSame = songCache.find((s) => s.title === song.title)
  const isPlaying = songSame?.title === playing?.metadata?.title

  const artistSame = songCache.some((s) =>
    song.channel.toLowerCase().includes(s.artist.toLowerCase())
  )

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

  const handlePlay = async (cacheSong: typeof songSame) => {
    if (!cacheSong) return

    if (isPlaying && !paused) {
      setPaused(true)
      return
    } else if (isPlaying && paused) {
      setPaused(false)
      return
    }

    const body = {
      rootDir: currentDir,
      path: cacheSong.path,
      forceRefresh: false,
    }

    const response: any = await (window as any).electron.getSongByPath(body)
    if (response.song) {
      setPlaying(response?.song)
      startNewQueue(response?.song?.path)
      setPaused(false)
    }
  }

  const downloadSong = async (result: YoutubeDetailsResult) => {
    if (!currentDir) {
      toast.error('Please select a folder first');
      return;
    }

    setDownloading(true);
    setHasError(false);

    try {
      const response = await (window as any).electron.downloadYoutube({
        videoId: result.id,
        title: result.title,
        savePath: currentDir
      });

      if (response?.name) {
        setDownloaded(true);
        onDownloadComplete(response)
        const body = {
          title: response.metadata.title,
          artist: response.metadata.artist,
          path: response.path,
          thumbnail: response.metadata.thumbnail
        }
        addSongToCache(body)
        setTimeout(() => setDownloaded(false), 3000);
      } else {
        setHasError(true);
        toast.error(response.error || 'Download failed');
        setTimeout(() => {
          setHasError(false);
        }, 1000);
      }
    } catch (err: any) {
      setHasError(true);
      const errorMsg = err.toString() || 'Failed to download video';
      toast.error(errorMsg);
      setTimeout(() => {
        setHasError(false);
      }, 1000);
    } finally {
      setDownloading(false);
    }
  }

  const cancelSongDownload = async () => {
    try {
      await (window as any).electron.cancelDownload()
      toast.info(`Cancelled: ${song.title}`)
    } catch (err) {
      console.error('Error cancelling song download:', err)
    }
  }

  const isDownloading = downloading || globalIsDownloading
  const isDownloaded = downloaded || globalIsDownloaded

  return (
    <div
      key={song.id}
      className={`flex justify-between p-2 rounded-lg ${index % 2 === 0 ? "bg-muted/80" : ""}`}
    >
      <div className="flex items-center gap-4">
        <div className="shrink-0 aspect-square bg-white/10 p-1 rounded-lg">
          <img
            className="shrink-0 w-10 h-10 object-cover rounded-lg"
            src={song.thumbnail}
            alt={song.title}
          />
        </div>
        <div className={getStyles()}>
          <p>{song.title} - {song.channel} </p>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <div className="font-semibold text-muted-foreground">
          {formatDuration(song.lengthSeconds)}
        </div>

        {songSame && artistSame && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handlePlay(songSame)}
          >
            {isPlaying && !paused ? (
              <div>
                <Pause className="text-primary" />
              </div>
            ) : (
              <div>

                <Play className="text-primary" />
              </div>
            )}
          </Button>
        )}

        {songSame && !artistSame && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePlay(songSame)}
            >
              {isPlaying && !paused ? (
                <Pause className="text-primary" />
              ) : (
                <Play className="text-primary" />
              )}
            </Button>
            {/* {isDownloading && ( */}
            {/*   <Button */}
            {/*     variant="destructive" */}
            {/*     size="sm" */}
            {/*     onClick={cancelSongDownload} */}
            {/*   > */}
            {/*     <X /> */}
            {/*   </Button> */}
            {/* )} */}
            <Button
              disabled={isDownloaded || isDownloading}
              onClick={() => downloadSong(song)}
              className={hasError ? 'animate-pulse bg-red-500 hover:bg-red-600' : ''}
              variant={"red"}
              size="sm"
            >
              {isDownloading ? (
                <Loader2 className="animate-spin" />
              ) : (
                isDownloaded ? <Check /> : <Download />
              )}
            </Button>
          </>
        )}

        {/* No match or artist only - show download button */}
        {!songSame && (
          <>
            {/* {isDownloading && ( */}
            {/*   <Button */}
            {/*     variant="destructive" */}
            {/*     size="sm" */}
            {/*     onClick={cancelSongDownload} */}
            {/*   > */}
            {/*     <X /> */}
            {/*   </Button> */}
            {/* )} */}
            <Button
              disabled={isDownloaded || isDownloading}
              onClick={() => downloadSong(song)}
              className={hasError ? 'animate-pulse bg-red-500 hover:bg-red-600' : ''}
              variant={"red"}
              size="sm"
            >
              {isDownloading ? (
                <Loader2 className="animate-spin" />
              ) : (
                isDownloaded ? <Check /> : <Download />
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default PlaylistSongItem
