// Stand-ins shaped like what's coming, while YouTube answers.
import { Skeleton } from "@/components/ui/skeleton"

const sr = <span className="sr-only">Loading…</span>

/** A closed playlist row. */
export function PlaylistListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" data-testid="playlist-skeleton" className="flex flex-col gap-3">
      {sr}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background-light p-3">
          <Skeleton className="size-art-md shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** The songs inside an open playlist. */
export function VideoRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" data-testid="video-skeleton" className="flex flex-col gap-1">
      {sr}
      <div className="mb-2 flex gap-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-40" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-12 items-center gap-3">
          <Skeleton className="size-art-sm shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-3 w-10" />
        </div>
      ))}
    </div>
  )
}

/** Search results, as cards. */
export function VideoGridSkeleton({ cards = 12 }: { cards?: number }) {
  return (
    <div role="status" data-testid="search-skeleton" className="flex flex-wrap justify-center gap-4">
      {sr}
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="flex w-card flex-col gap-2 rounded-2xl bg-background-light p-2">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}
