import { useMemo } from "react"
import { History } from "lucide-react"
import { Page, PageHeader, Section, EmptyState } from "@/components/base/Page"
import { SongList } from "@/components/song/SongRow"
import { resolveSongs, useLibraryStore } from "@/stores/useLibraryStore"
import { useUserStore } from "@/stores/useUserStore"
import type { QueueContext } from "@/player/queue"

const CONTEXT: QueueContext = { type: "history", label: "Recently played" }

export default function HistoryPage() {
  const recent = useUserStore((s) => s.recentlyPlayed)
  const byId = useLibraryStore((s) => s.songsById)
  const songs = useMemo(() => resolveSongs(recent.map((r) => r.songId), byId), [recent, byId])
  return (
    <Page>
      <PageHeader eyebrow="History" title="Recently played" icon={History} colorKey="history" meta={<span>{songs.length} songs</span>} />
      <Section>{songs.length ? <SongList songs={songs} queueContext={CONTEXT} /> : <EmptyState icon={History} title="Nothing played yet" />}</Section>
    </Page>
  )
}
