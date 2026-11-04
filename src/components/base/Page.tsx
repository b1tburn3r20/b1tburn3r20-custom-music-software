import { cn } from "@/lib/utils"
import { useColorCacheStore } from "@/stores/useColorCacheStore"
import type { LucideIcon } from "lucide-react"
import { Artwork } from "./Artwork"

/** Outer wrapper for every routed page. */
export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col pb-16", className)}>{children}</div>
}

/** Horizontal content padding used by every page section. */
export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-screen-2xl px-8", className)}>{children}</div>
}

type HeaderProps = {
  /** Small uppercase label above the title ("Playlist", "Album"…). */
  eyebrow: string
  title: string
  /** Line(s) under the title: artists, counts, duration… */
  meta?: React.ReactNode
  description?: string
  artwork?: string | null
  /** Shown instead of artwork when there is none. */
  icon?: LucideIcon
  /** Stable id used to pick a fallback accent color. */
  colorKey: string
  actions?: React.ReactNode
}

/** Hero header shared by playlist, album, artist, liked songs, search and history pages. */
export function PageHeader({ eyebrow, title, meta, description, artwork, icon: Icon, colorKey, actions }: HeaderProps) {
  const color = useColorCacheStore((s) => s.getColor(artwork ?? undefined, colorKey))
  return (
    <header className="relative" style={{ ["--art-rgb" as string]: color }}>
      <div className="art-gradient absolute inset-0 -z-10 transition-[background-image] duration-slow" aria-hidden />
      <Container className="flex items-end gap-6 pt-10 pb-6">
        {artwork || !Icon ? (
          <Artwork src={artwork} size="lg" className="shadow-2xl" />
        ) : (
          <div className="art-tint flex size-art-lg shrink-0 items-center justify-center rounded-lg shadow-2xl">
            <Icon className="art-text size-20" aria-hidden />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2 pb-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-foreground/80">{eyebrow}</p>
          <h1 className="text-5xl font-bold tracking-tight truncate" title={title}>
            {title}
          </h1>
          {description && <p className="text-sm text-foreground/80 line-clamp-2">{description}</p>}
          {meta && <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground/80">{meta}</div>}
        </div>
      </Container>
      {actions && <Container className="flex items-center gap-4 pb-4">{actions}</Container>}
    </header>
  )
}

export function Section({ title, action, children, className }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("py-6", className)}>
      <Container>
        {(title || action) && (
          <div className="mb-4 flex items-center justify-between gap-4">
            {title && <h2 className="text-2xl font-bold tracking-tight">{title}</h2>}
            {action}
          </div>
        )}
        {children}
      </Container>
    </section>
  )
}

export function EmptyState({ icon: Icon, title, hint, action }: { icon: LucideIcon; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
      <Icon className="size-14 opacity-50" aria-hidden />
      <p className="text-lg font-medium text-foreground">{title}</p>
      {hint && <p className="text-sm">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function CardGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6", className)}>{children}</div>
}
