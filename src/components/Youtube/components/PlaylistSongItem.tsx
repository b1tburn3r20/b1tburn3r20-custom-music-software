import { Button } from "@/components/ui/button"
import { usePlayerStore } from "@/stores/usePlayerStore"
import type { Song } from "@/types/DirectoryTypes"
import type { YoutubeDetailsResult } from "@/types/YoutubeTypes"
import { startNewQueue } from "@/utils/musicutils"
import { formatDuration } from "@/utils/textUtils"
import { Check, Download, Loader2, Pause, Play } from "lucide-react"
import { memo } from "react"
import { toast } from "sonner"

type CachedSong = {
  title: string
  artist: string
  path: string
  thumbnail: string
}

interface PlaylistSongItemProps {
  song: YoutubeDetailsResult
  index: number
  currentDir: unknown | null
  isDownloading: boolean
  isDownloaded: boolean
  isPlaying: boolean
  isPaused: boolean
  songSame: CachedSong | undefined
  artistSame: boolean
  onDownloadSong: (song: YoutubeDetailsResult) => Promise<void>
  onDownloadComplete: (song: Song) => void
}

const arePropsEqual = (prev: PlaylistSongItemProps, next: PlaylistSongItemProps) => {
  return (
    prev.isDownloading === next.isDownloading &&
    prev.isDownloaded === next.isDownloaded &&
    prev.isPlaying === next.isPlaying &&
    prev.isPaused === next.isPaused &&
    prev.songSame === next.songSame &&
    prev.artistSame === next.artistSame
  )
}

const PlaylistSongItem = memo(({
  song,
  index,
  currentDir,
  isDownloading,
  isDownloaded,
  isPlaying,
  isPaused,
  songSame,
  artistSame,
  onDownloadSong,
  onDownloadComplete,
}: PlaylistSongItemProps) => {
  const setPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const setPaused = usePlayerStore((f) => f.setPaused)

  const getStyles = () => {
    if (songSame && artistSame) return "text-emerald-500"
    if (songSame) return "text-red-500"
    if (artistSame) return "text-amber-500"
    return ""
  }

  const handlePlay = async () => {
    if (!songSame) return

    if (isPlaying && !isPaused) {
      setPaused(true)
      return
    } else if (isPlaying && isPaused) {
      setPaused(false)
      return
    }

    const response: any = await (window as any).electron.getSongByPath({
      rootDir: currentDir,
      path: songSame.path,
      forceRefresh: false,
    })

    if (response.song) {
      setPlaying(response.song)
      startNewQueue(response.song.path)
      setPaused(false)
    }
  }

  const handleDownload = async () => {
    if (!currentDir) {
      toast.error('Please select a folder first')
      return
    }
    await onDownloadSong(song)
  }

  const showPlayButton = !!songSame
  const showDownloadButton = !songSame || !artistSame

  return (
    <div className={`flex justify-between p-2 rounded-lg ${index % 2 === 0 ? "bg-muted/80" : ""}`}>
      <div className="flex items-center gap-4">
        <div className="shrink-0 aspect-square bg-white/10 p-1 rounded-lg">
          <img className="shrink-0 w-10 h-10 object-cover rounded-lg" src={song.thumbnail} alt={song.title} />
        </div>
        <div className={getStyles()}>
          <p>{song.title} - {song.channel}</p>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <div className="font-semibold text-muted-foreground">
          {formatDuration(song.lengthSeconds)}
        </div>

        {showPlayButton && (
          <Button variant="ghost" size="sm" onClick={handlePlay}>
            {isPlaying && !isPaused ? <Pause className="text-primary" /> : <Play className="text-primary" />}
          </Button>
        )}

        {showDownloadButton && (
          <Button
            disabled={isDownloaded || isDownloading}
            onClick={handleDownload}
            variant="red"
            size="sm"
          >
            {isDownloading ? <Loader2 className="animate-spin" /> : isDownloaded ? <Check /> : <Download />}
          </Button>
        )}
      </div>
    </div>
  )
}, arePropsEqual)

export default PlaylistSongItem
