import { memo, useState } from "react"
import { Pause, Play } from "lucide-react"
import type { AlbumType } from "@/types/AppTypes"
import { Artwork } from "@/components/base/Artwork"
import { navigate } from "@/stores/useAppStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { playContext, togglePlay } from "@/player/controls"
import { cn } from "@/lib/utils"

export const AlbumCard = memo(function AlbumCard({ album }: { album: AlbumType }) {
  const [hovered, setHovered] = useState(false)
  const isThis = usePlayerStore((s) => s.queue.context?.type === "album" && s.queue.context.id === album.key)
  const playing = usePlayerStore((s) => !s.paused) && isThis
  const artists = album.album_artists.length >= 5 ? "Various artists" : album.album_artists.join(", ")
  const play = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isThis) togglePlay()
    else playContext(album.album_songs, 0, { type: "album", id: album.key, label: album.album_name })
  }
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate({ name: "album", key: album.key })}
      onKeyDown={(e) => e.key === "Enter" && navigate({ name: "album", key: album.key })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group flex flex-col gap-2 rounded-xl p-3 cursor-pointer outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative">
        <Artwork src={album.album_thumbnail} size="fill" alt="" />
        <button
          type="button"
          aria-label={playing ? `Pause ${album.album_name}` : `Play ${album.album_name}`}
          onClick={play}
          className={cn("absolute bottom-2 right-2 rounded-full bg-primary p-3 text-primary-foreground shadow-lg transition-all", hovered || isThis ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1")}
        >
          {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
        </button>
      </div>
      <div className="min-w-0 text-sm">
        <p className={cn("font-semibold truncate", isThis && "text-primary")} title={album.album_name}>
          {album.album_name}
        </p>
        <p className="text-muted-foreground truncate">
          {artists}
          {album.album_release_date[0] ? ` · ${album.album_release_date[0]}` : ""}
        </p>
      </div>
    </div>
  )
})
