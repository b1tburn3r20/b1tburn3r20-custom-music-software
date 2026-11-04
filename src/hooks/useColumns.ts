import { useLayoutEffect, useRef, useState } from "react"

/** How many columns of at least `minWidth` px fit in the element, live as it resizes. */
export function useColumns(minWidth: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setColumns(Math.max(1, Math.floor(el.clientWidth / minWidth)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [minWidth])
  return { ref, columns }
}
