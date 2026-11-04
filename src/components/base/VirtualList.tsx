// A vertical list that only mounts the rows near the viewport once it gets long.
// It scrolls with the surrounding ScrollArea (the page, or a dialog's list), so it
// can sit anywhere in a page below other content.
import { useLayoutEffect, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useScrollParent } from "@/app/scrollContext"
import { cn } from "@/lib/utils"

export type VirtualListProps<T> = {
  items: readonly T[]
  /** Stable, unique key per row (also keys the virtualizer's size cache). */
  getKey: (item: T, index: number) => React.Key
  renderItem: (item: T, index: number) => React.ReactNode
  /** Expected row height in px; rows are measured once rendered, so this only needs to be close. */
  estimateSize: number | ((item: T, index: number) => number)
  /** Below this many rows everything is rendered normally. */
  threshold?: number
  overscan?: number
  className?: string
}

export function VirtualList<T>({ items, getKey, renderItem, estimateSize, threshold = 60, overscan = 12, className }: VirtualListProps<T>) {
  const scrollParent = useScrollParent()
  if (items.length <= threshold || !scrollParent) {
    // No scroll container yet (first frame): render only the first screenful, never the whole list.
    const shown = scrollParent ? items : items.slice(0, threshold)
    return (
      <div className={cn("flex min-w-0 flex-col", className)}>
        {shown.map((item, i) => (
          <div key={getKey(item, i)} className="min-w-0">
            {renderItem(item, i)}
          </div>
        ))}
      </div>
    )
  }
  return <Virtualized items={items} getKey={getKey} renderItem={renderItem} estimateSize={estimateSize} overscan={overscan} className={className} scrollParent={scrollParent} />
}

function Virtualized<T>({ items, getKey, renderItem, estimateSize, overscan, className, scrollParent }: Omit<VirtualListProps<T>, "threshold"> & { scrollParent: HTMLElement }) {
  const listRef = useRef<HTMLDivElement>(null)
  const offset = useOffsetIn(scrollParent, listRef)
  const v = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollParent,
    estimateSize: (i) => (typeof estimateSize === "number" ? estimateSize : estimateSize(items[i], i)),
    getItemKey: (i) => getKey(items[i], i),
    overscan,
    scrollMargin: offset,
  })
  return (
    <div ref={listRef} className={cn("relative min-w-0", className)} style={{ height: v.getTotalSize() }}>
      {v.getVirtualItems().map((item) => (
        <div key={item.key} data-index={item.index} ref={v.measureElement} className="absolute inset-x-0 top-0 min-w-0" style={{ transform: `translateY(${item.start - v.options.scrollMargin}px)` }}>
          {renderItem(items[item.index], item.index)}
        </div>
      ))}
    </div>
  )
}

/**
 * Where the list starts inside the scroll container's content. Re-measured whenever
 * the container or anything in it changes size (a banner appearing above the list,
 * another panel opening, the window resizing), so the visible rows never drift.
 */
function useOffsetIn(scrollParent: HTMLElement, listRef: React.RefObject<HTMLElement | null>) {
  const [offset, setOffset] = useState(0)
  useLayoutEffect(() => {
    const measure = () => {
      const el = listRef.current
      if (!el) return
      const next = Math.round(el.getBoundingClientRect().top - scrollParent.getBoundingClientRect().top + scrollParent.scrollTop)
      setOffset((prev) => (prev === next ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(scrollParent)
    // The content wrapper grows/shrinks with every layout change inside it.
    for (const child of scrollParent.children) ro.observe(child)
    return () => ro.disconnect()
  }, [scrollParent, listRef])
  return offset
}
