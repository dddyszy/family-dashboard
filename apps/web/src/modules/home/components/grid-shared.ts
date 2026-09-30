import { BREAKPOINT_COLS, BREAKPOINT_WIDTHS, type BreakpointName } from '@shared/schemas/dashboard'
import { useLayoutEffect, useRef, useState } from 'react'

export const GRID_MARGIN = 16

export function breakpointFor(width: number): BreakpointName {
  if (width >= BREAKPOINT_WIDTHS.lg) return 'lg'
  if (width >= BREAKPOINT_WIDTHS.md) return 'md'
  return 'sm'
}

/** Square cells: row height equals column width. */
export function rowHeightFor(width: number, breakpoint: BreakpointName): number {
  const cols = BREAKPOINT_COLS[breakpoint]
  return Math.max(60, (width - GRID_MARGIN * (cols - 1)) / cols)
}

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}
