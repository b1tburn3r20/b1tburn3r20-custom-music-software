import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useColumns } from "@/hooks/useColumns"
import { cn } from "@/lib/utils"

type Props<T> = {
  items: readonly T[]
  /** Smallest comfortable item width in px; the column count follows the available width. */
  minWidth: number
  /** Roughly how many items to show at first, rounded up to a full row. */
  count: number
  minRows?: number
  getKey: (item: T) => string
  render: (item: T, index: number) => React.ReactNode
  className?: string
}

/**
 * Grid that fits its own width rather than the window's, in portrait or landscape,
 * and only ever shows full rows. "Show more" reveals the rest in steps.
 */
export function AutoGrid<T>({ items, minWidth, count, minRows = 1, getKey, render, className }: Props<T>) {
  const { ref, columns } = useColumns(minWidth)
  const [extra, setExtra] = useState(0)
  const rows = Math.max(minRows, Math.ceil(count / columns)) + extra
  const shown = items.slice(0, rows * columns)
  return (
    <>
      <div ref={ref} className={cn("grid gap-x-1", className)} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {shown.map((item, i) => (
          <div key={getKey(item)} className="min-w-0">
            {render(item, i)}
          </div>
        ))}
      </div>
      {items.length > shown.length && (
        <Button variant="ghost" size="sm" className="mt-1 w-full text-muted-foreground" onClick={() => setExtra((e) => e + Math.max(2, Math.ceil(count / columns)))}>
          Show more
        </Button>
      )}
    </>
  )
}
