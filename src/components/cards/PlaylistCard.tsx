import { memo, useState } from "react"
import { ListMusic, Pause, Play } from "lucide-react"
import type { Playlist } from "@/types/api"
import { Artwork } from "@/components/base/Artwork"
import { navigate } from "@/stores/useAppStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { resolveSongs, useLibraryStore } from "@/stores/useLibraryStore"
import { playContext, togglePlay } from "@/player/controls"
import { cn } from "@/lib/utils"

export const PlaylistCard = memo(function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const [hovered, setHovered] = useState(false)
  const byId = useLibraryStore((s) => s.songsById)
  const isThis = usePlayerStore((s) => s.queue.context?.type === "playlist" && s.queue.context.id === playlist.id)
  const playing = usePlayerStore((s) => !s.paused) && isThis
  const cover = byId[playlist.songIds[0]]?.metadata.thumbnail ?? null
  const play = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isThis) togglePlay()
    else playContext(resolveSongs(playlist.songIds, byId), 0, { type: "playlist", id: playlist.id, label: playlist.name })
  }
  const go = () => navigate({ name: "playlist", id: playlist.id })
  return (
    <div role="link" tabIndex={0} onClick={go} onKeyDown={(e) => e.key === "Enter" && go()} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} className="flex flex-col gap-2 rounded-xl p-3 cursor-pointer outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring">
      <div className="relative">
        {cover ? <Artwork src={cover} size="fill" /> : <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center"><ListMusic className="size-1/3 text-muted-foreground" /></div>}
        {playlist.songIds.length > 0 && (
          <button type="button" aria-label={playing ? `Pause ${playlist.name}` : `Play ${playlist.name}`} onClick={play} className={cn("absolute bottom-2 right-2 rounded-full bg-primary p-3 text-primary-foreground shadow-lg transition-all", hovered || isThis ? "opacity-100" : "opacity-0")}>
            {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
          </button>
        )}
      </div>
      <div className="min-w-0 text-sm">
        <p className={cn("font-semibold truncate", isThis && "text-primary")}>{playlist.name}</p>
        <p className="text-muted-foreground">
          {playlist.songIds.length} {playlist.songIds.length === 1 ? "song" : "songs"}
        </p>
      </div>
    </div>
  )
})
