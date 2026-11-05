import { useMemo } from "react"
import { Heart, X } from "lucide-react"
import { Page, PageHeader, Section, EmptyState } from "@/components/base/Page"
import { PlayAllButton, ShuffleAllButton, TagAllButton } from "@/components/base/HeaderActions"
import { SongList } from "@/components/song/SongRow"
import { Button } from "@/components/ui/button"
import { resolveSongs, useLibraryStore } from "@/stores/useLibraryStore"
import { useUserStore } from "@/stores/useUserStore"
import { useYoutubeAccount } from "@/components/youtube/accessStore"
import { formatDuration } from "@/utils/textUtils"
import type { QueueContext } from "@/player/queue"

const CONTEXT: QueueContext = { type: "liked", label: "Liked Songs" }

export default function LikedPage() {
  const likedOnYoutube = useYoutubeAccount((s) => s.account?.liked.filter((v) => v.isMusic).length ?? 0)
  const likes = useUserStore((s) => s.likes)
  const notice = useUserStore((s) => s.notices.find((n) => n.id.startsWith("likes-corruption")))
  const byId = useLibraryStore((s) => s.songsById)
  const songs = useMemo(() => resolveSongs(likes.map((l) => l.songId), byId), [likes, byId])
  const total = songs.reduce((a, s) => a + (s.metadata.duration || 0), 0)
  return (
    <Page>
      <PageHeader
        eyebrow="Playlist"
        title="Liked Songs"
        icon={Heart}
        colorKey="liked-songs"
        meta={<span>{songs.length} {songs.length === 1 ? "song" : "songs"} · {formatDuration(total)}</span>}
        actions={
          <>
            <PlayAllButton songs={songs} context={CONTEXT} />
            <ShuffleAllButton songs={songs} context={CONTEXT} />
            <TagAllButton songs={songs} />
          </>
        }
      />
      {notice && (
        <Section className="pb-0">
          <div role="status" className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4 text-sm">
            <p className="flex-1">{notice.message}</p>
            <Button size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={() => window.api.user.dismissNotice(notice.id)}>
              <X />
            </Button>
          </div>
        </Section>
      )}
      <Section>
        {songs.length ? <SongList songs={songs} queueContext={CONTEXT} /> : <EmptyState icon={Heart} title="No liked songs yet" hint={likedOnYoutube ? `Tap the heart on any song to add it here. You have ${likedOnYoutube} liked ${likedOnYoutube === 1 ? "video" : "videos"} on YouTube ready to download from Home.` : "Tap the heart on any song to add it here."} />}
      </Section>
    </Page>
  )
}
