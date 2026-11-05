// Songs the user likes on YouTube but doesn't have yet. Also how bulk downloads pick up after
// a restart: anything that didn't finish is still not owned, so it's simply offered again.
import { useMemo } from "react"
import { Download, X } from "lucide-react"
import { Artwork } from "@/components/base/Artwork"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/base/IconButton"
import { HomeSection } from "./HomeSection"
import { useYoutubeAccount } from "@/components/youtube/accessStore"
import { enqueueVideos } from "@/components/youtube/downloadActions"
import { useOwnedIndex } from "@/components/youtube/useOwned"
import { isActive, useDownloadStore } from "@/stores/useDownloadStore"

const SHOWN = 8

export function YoutubeSuggestions() {
  const account = useYoutubeAccount((s) => s.account)
  const downloads = useDownloadStore((s) => s.byId)
  const owned = useOwnedIndex()
  const all = useMemo(() => {
    if (!account) return []
    const dismissed = new Set(account.dismissed)
    return account.liked.filter((v) => v.isMusic && !dismissed.has(v.id) && !owned(v))
  }, [account, owned])
  const visible = all.filter((v) => !isActive(downloads[v.id])).slice(0, SHOWN)
  if (!visible.length) return null
  return (
    <HomeSection
      title="From your YouTube"
      action={
        <Button size="sm" variant="ghost" onClick={() => void enqueueVideos(all.map((v) => ({ videoId: v.id, title: v.title, channel: v.channel, duration: v.duration })))}>
          <Download /> {all.length === 1 ? "Download" : `Download all ${all.length}`}
        </Button>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {visible.map((v) => (
          <div key={v.id} className="flex items-center gap-3 rounded-lg bg-card p-2">
            <Artwork src={v.thumbnail} className="size-12 shrink-0 rounded-md" size="fill" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{v.title}</p>
              <p className="truncate text-xs text-muted-foreground">{v.channel}</p>
            </div>
            <IconButton icon={Download} size="sm" label={`Download ${v.title}`} onClick={() => void enqueueVideos([{ videoId: v.id, title: v.title, channel: v.channel, duration: v.duration }])} />
            <IconButton icon={X} size="sm" label={`Don't suggest ${v.title}`} onClick={() => void window.api.youtube.dismissSuggestion(v.id)} />
          </div>
        ))}
      </div>
    </HomeSection>
  )
}
