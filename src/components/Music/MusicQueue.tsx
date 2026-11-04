import { Separator } from "@/components/ui/separator"
import { SongRow } from "@/components/song/SongRow"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { jumpTo, togglePlay } from "@/player/controls"
import { useEffect, useMemo, useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { Song } from "@/types/DirectoryTypes"
import type { QueueItem } from "@/player/queue"

const CONTEXT_LABEL: Record<string, string> = {
  playlist: "Playlist", album: "Album", artist: "Artist", liked: "Liked Songs", search: "Search", radio: "Radio", history: "History", downloads: "Downloads", list: "Queue",
}

type QueueRow = { item: QueueItem; pos: number; song: Song }

function QueueRows({ rows, currentUid, currentPos, collapse }: { rows: QueueRow[]; currentUid: string | null; currentPos: number; collapse: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const v = useVirtualizer({ count: rows.length, getScrollElement: () => ref.current, estimateSize: () => 68, overscan: 10 })
  // Keep the current song in view when it changes.
  const currentIndex = rows.findIndex((r) => r.item.uid === currentUid)
  useEffect(() => {
    if (currentIndex >= 0) v.scrollToIndex(currentIndex, { align: "center" })
  }, [currentIndex, v])
  return (
    <div ref={ref} className="h-[85dvh] min-h-0 overflow-y-auto px-4 pt-4">
      <div className="relative md:min-w-queue" style={{ height: v.getTotalSize() }}>
        {v.getVirtualItems().map((vi) => {
          const { item, song, pos } = rows[vi.index]
          return (
            <div key={item.uid} data-index={vi.index} ref={v.measureElement} className="absolute inset-x-0 top-0" style={{ transform: `translateY(${vi.start}px)` }}>
              <SongRow
                song={song}
                variant="compact"
                showTags
                queueUid={item.uid}
                isCurrent={item.uid === currentUid}
                onActivate={() => (item.uid === currentUid ? togglePlay() : jumpTo(item.uid))}
                dimmed={pos < currentPos}
                badge={item.source === "user" ? "queued" : item.source === "radio" ? "radio" : undefined}
                onNavigate={collapse}
              />
              {pos === currentPos && <Separator className="my-2" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** The queue in playback order: played songs (dimmed), the current song, then upcoming. */
const MusicQueue = () => {
  const queue = usePlayerStore((s) => s.queue)
  const currentUid = usePlayerStore((s) => s.currentUid)
  const songsById = useLibraryStore((s) => s.songsById)
  const collapse = () => useSettingsStore.getState().setPlayerExpanded(false)

  const rows = useMemo(
    () => queue.order.map((idx, pos) => ({ item: queue.items[idx], pos, song: songsById[queue.items[idx].songId] })).filter((r): r is QueueRow => Boolean(r.song)),
    [queue, songsById],
  )
  if (!rows.length) return null
  const ctx = queue.context
  return (
    <div className="w-full flex justify-end">
      <div className="flex h-full max-w-md flex-col rounded-bl-lg bg-background/60 backdrop-blur-lg 2xl:max-w-lg">
        <div className="flex min-w-0 select-none items-baseline gap-2 p-4 pb-0 text-xl font-bold text-muted-foreground">
          <span className="truncate">{ctx?.label ?? "Queue"}</span>
          <span className="shrink-0 text-sm font-medium">{CONTEXT_LABEL[ctx?.type ?? "list"]}</span>
        </div>
        <QueueRows rows={rows} currentUid={currentUid} currentPos={queue.pos} collapse={collapse} />
      </div>
    </div>
  )
}

export default MusicQueue
