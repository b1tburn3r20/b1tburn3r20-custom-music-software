import { memo, useState } from "react"
import { Pause, Play } from "lucide-react"
import { Artwork } from "@/components/base/Artwork"
import { Button } from "@/components/ui/button"
import { formatDuration } from "@/utils/textUtils"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { playRadio, togglePlay } from "@/player/controls"
import type { YtVideo } from "@/lib/youtubeApi"
import type { Song } from "@/types/DirectoryTypes"
import { SongContextMenu, SongMoreButton } from "@/components/song/SongContextMenu"
import { DownloadButton } from "./DownloadButton"

/** A YouTube search result: preview, play if already in the library, otherwise download. */
export const VideoCard = memo(function VideoCard({ video, owned }: { video: YtVideo; owned: { song: Song; exact: boolean } | null }) {
  const [embed, setEmbed] = useState(false)
  const isCurrent = usePlayerStore((s) => Boolean(owned) && s.currentSongId === owned?.song.id)
  const playing = usePlayerStore((s) => !s.paused) && isCurrent
  const card = (
    <div className="flex w-card flex-col gap-2 rounded-2xl bg-card p-2">
      <div className="relative overflow-hidden rounded-xl">
        {embed && video.embeddable ? (
          <iframe className="aspect-video w-full" src={`https://www.youtube.com/embed/${video.id}?autoplay=1`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" title={video.title} />
        ) : (
          <button type="button" className="group relative block w-full" onClick={() => video.embeddable && setEmbed(true)} aria-label={video.embeddable ? `Preview ${video.title}` : undefined} disabled={!video.embeddable}>
            <Artwork src={video.thumbnail} className="aspect-video h-auto w-full rounded-none" size="fill" />
            {video.embeddable && (
              <span className="absolute inset-0 flex items-center justify-center bg-scrim opacity-0 transition-opacity group-hover:opacity-100">
                <span className="rounded-full bg-youtube p-3 text-destructive-foreground">
                  <Play className="size-6 fill-current" />
                </span>
              </span>
            )}
            <span className="absolute bottom-1 right-1 rounded bg-scrim px-1.5 text-xs tabular-nums text-foreground">{formatDuration(video.duration)}</span>
          </button>
        )}
      </div>
      <div className="min-w-0 px-1 text-sm" title={video.title}>
        <p className={owned ? "line-clamp-2 font-semibold text-success" : "line-clamp-2 font-semibold"}>{video.title}</p>
        <p className="truncate text-muted-foreground">{video.channel}</p>
      </div>
      <div className="mt-auto flex gap-2">
        {owned && (
          <Button size="sm" variant="secondary" className="flex-1" onClick={() => (isCurrent ? togglePlay() : playRadio(owned.song))}>
            {playing ? <Pause /> : <Play />} {playing ? "Pause" : "Play"}
          </Button>
        )}
        <DownloadButton videoId={video.id} title={video.title} channel={video.channel} duration={video.duration} owned={Boolean(owned)} className="flex-1" />
        {owned && <SongMoreButton song={owned.song} ctx={NO_LIST} />}
      </div>
    </div>
  )
  // Already in the library: the same right-click menu as any song (play, tag, add to playlist…).
  return owned ? <SongContextMenu song={owned.song} ctx={NO_LIST}>{card}</SongContextMenu> : card
})

/** A lone search result has no surrounding list: Play starts a radio. */
const NO_LIST = {}
