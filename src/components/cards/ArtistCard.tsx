import { memo } from "react"
import { Artwork } from "@/components/base/Artwork"
import { navigate } from "@/stores/useAppStore"

export const ArtistCard = memo(function ArtistCard({ name, thumbnail, songCount }: { name: string; thumbnail: string | null; songCount: number }) {
  const go = () => navigate({ name: "artist", artist: name })
  return (
    <div role="link" tabIndex={0} onClick={go} onKeyDown={(e) => e.key === "Enter" && go()} className="flex flex-col items-center gap-2 rounded-xl p-3 text-center cursor-pointer outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring">
      <Artwork src={thumbnail} size="fill" className="rounded-full" />
      <div className="min-w-0 w-full text-sm">
        <p className="font-semibold truncate" title={name}>
          {name}
        </p>
        <p className="text-muted-foreground">
          {songCount} {songCount === 1 ? "song" : "songs"}
        </p>
      </div>
    </div>
  )
})
