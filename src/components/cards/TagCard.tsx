import { memo } from "react"
import { Tag } from "lucide-react"
import { Artwork } from "@/components/base/Artwork"
import { navigate } from "@/stores/useAppStore"

export const TagCard = memo(function TagCard({ name, count, own, thumbnail }: { name: string; count: number; own: boolean; thumbnail: string | null }) {
  const go = () => navigate({ name: "tag", tag: name })
  return (
    <div role="link" tabIndex={0} onClick={go} onKeyDown={(e) => e.key === "Enter" && go()} className="flex flex-col gap-2 rounded-xl p-3 outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring">
      <div className="relative">
        <Artwork src={thumbnail} size="fill" />
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-scrim px-2 py-0.5 text-xs text-foreground">
          <Tag className="size-3" aria-hidden /> {own ? "Your tag" : "Genre"}
        </span>
      </div>
      <div className="min-w-0 text-sm">
        <p className="truncate font-semibold capitalize" title={name}>
          {name}
        </p>
        <p className="text-muted-foreground">
          {count} {count === 1 ? "song" : "songs"}
        </p>
      </div>
    </div>
  )
})
