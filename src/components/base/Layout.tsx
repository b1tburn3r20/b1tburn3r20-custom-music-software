import { cn } from "@/lib/utils"

type Gap = 0 | 1 | 2 | 3 | 4 | 6 | 8
const GAP: Record<Gap, string> = { 0: "gap-0", 1: "gap-1", 2: "gap-2", 3: "gap-3", 4: "gap-4", 6: "gap-6", 8: "gap-8" }

type BoxProps = React.HTMLAttributes<HTMLDivElement> & { gap?: Gap }

/** Vertical stack. */
export function Stack({ gap = 2, className, ...rest }: BoxProps) {
  return <div className={cn("flex flex-col", GAP[gap], className)} {...rest} />
}

/** Horizontal row, vertically centered. */
export function Row({ gap = 2, className, ...rest }: BoxProps) {
  return <div className={cn("flex items-center", GAP[gap], className)} {...rest} />
}

/** Raised surface for grouped content (settings groups, notices, panels). */
export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-border/60 bg-card p-4 text-card-foreground", className)} {...rest} />
}

export function Heading({ level = 2, className, ...rest }: React.HTMLAttributes<HTMLHeadingElement> & { level?: 1 | 2 | 3 }) {
  const Tag = `h${level}` as const
  const size = level === 1 ? "text-5xl font-bold" : level === 2 ? "text-2xl font-bold" : "text-lg font-semibold"
  return <Tag className={cn("tracking-tight", size, className)} {...rest} />
}

export function Text({ tone = "default", size = "sm", className, ...rest }: React.HTMLAttributes<HTMLParagraphElement> & { tone?: "default" | "muted" | "danger"; size?: "xs" | "sm" | "base" }) {
  return <p className={cn(size === "xs" ? "text-xs" : size === "sm" ? "text-sm" : "text-base", tone === "muted" && "text-muted-foreground", tone === "danger" && "text-destructive", className)} {...rest} />
}

/** Full-width clickable list entry (menus inside dialogs, search actions…). */
export function ListButton({ className, selected, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      className={cn("flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60", selected && "bg-accent/30 ring-2 ring-primary/50", className)}
      {...rest}
    />
  )
}
