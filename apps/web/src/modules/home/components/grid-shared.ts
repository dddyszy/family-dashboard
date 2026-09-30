import { BREAKPOINT_COLS, BREAKPOINT_WIDTHS, type BreakpointName } from '@shared/schemas/dashboard'
import { useLayoutEffect, useRef, useState } from 'react'

export const GRID_MARGIN = 16

export function breakpointFor(width: number): BreakpointName {
  if (width >= BREAKPOINT_WIDTHS.lg) return 'lg'
  if (width >= BREAKPOINT_WIDTHS.md) return 'md'
  return 'sm'
}

/** Minimum row height on phones, where square cells get too short for a medium card's content. */
const SM_MIN_ROW_HEIGHT = 80

/** Square cells (row height equals column width), except on narrow phones. */
export function rowHeightFor(width: number, breakpoint: BreakpointName): number {
  const cols = BREAKPOINT_COLS[breakpoint]
  const square = (width - GRID_MARGIN * (cols - 1)) / cols
  return Math.max(breakpoint === 'sm' ? SM_MIN_ROW_HEIGHT : 60, square)
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
