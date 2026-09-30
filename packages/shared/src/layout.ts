import {
  BREAKPOINT_COLS,
  BREAKPOINTS,
  type LayoutItem,
  type Layouts,
  WIDGET_SIZE_DIMS,
  type WidgetSize,
} from './schemas/dashboard'

type Box = { i: string; w: number; h: number }

/** Skyline packing: each box goes to the lowest (then leftmost) slot where it fits. */
export function packLayout(boxes: readonly Box[], cols: number): LayoutItem[] {
  const heights = new Array<number>(cols).fill(0)
  const result: LayoutItem[] = []
  for (const box of boxes) {
    const w = Math.min(box.w, cols)
    let bestX = 0
    let bestY = Number.POSITIVE_INFINITY
    for (let x = 0; x <= cols - w; x++) {
      const y = Math.max(...heights.slice(x, x + w))
      if (y < bestY) {
        bestY = y
        bestX = x
      }
    }
    result.push({ i: box.i, x: bestX, y: bestY, w, h: box.h })
    for (let x = bestX; x < bestX + w; x++) heights[x] = bestY + box.h
  }
  return result
}

export function layoutsForSizes(items: ReadonlyArray<{ id: string; size: WidgetSize }>): Layouts {
  const boxes = items.map((item) => ({ i: item.id, ...WIDGET_SIZE_DIMS[item.size] }))
  return {
    lg: packLayout(boxes, BREAKPOINT_COLS.lg),
    md: packLayout(boxes, BREAKPOINT_COLS.md),
    sm: packLayout(boxes, BREAKPOINT_COLS.sm),
  }
}

/** Places a new box below everything else on every breakpoint. */
export function appendToLayouts(layouts: Layouts, id: string, size: WidgetSize): Layouts {
  const { w, h } = WIDGET_SIZE_DIMS[size]
  const next = { ...layouts }
  for (const bp of BREAKPOINTS) {
    const items = layouts[bp]
    const bottom = items.reduce((max, item) => Math.max(max, item.y + item.h), 0)
    next[bp] = [...items, { i: id, x: 0, y: bottom, w: Math.min(w, BREAKPOINT_COLS[bp]), h }]
  }
  return next
}

export function resizeInLayouts(layouts: Layouts, id: string, size: WidgetSize): Layouts {
  const { w, h } = WIDGET_SIZE_DIMS[size]
  const next = { ...layouts }
  for (const bp of BREAKPOINTS) {
    const cols = BREAKPOINT_COLS[bp]
    next[bp] = layouts[bp].map((item) =>
      item.i === id
        ? { ...item, w: Math.min(w, cols), h, x: Math.min(item.x, cols - Math.min(w, cols)) }
        : item,
    )
  }
  return next
}

export function removeFromLayouts(layouts: Layouts, id: string): Layouts {
  return {
    lg: layouts.lg.filter((item) => item.i !== id),
    md: layouts.md.filter((item) => item.i !== id),
    sm: layouts.sm.filter((item) => item.i !== id),
  }
}

function collides(a: LayoutItem, b: LayoutItem): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/**
 * Moves every item up as far as it goes, mirroring react-grid-layout's vertical compaction, and
 * appends any widget missing from the layout at the bottom.
 */
export function compactLayout(
  items: readonly LayoutItem[],
  cols: number,
  ids?: readonly string[],
): LayoutItem[] {
  const known = ids ? items.filter((item) => ids.includes(item.i)) : [...items]
  const placed: LayoutItem[] = []
  const sorted = [...known].sort((a, b) => a.y - b.y || a.x - b.x)
  for (const item of sorted) {
    const w = Math.min(item.w, cols)
    const next = { ...item, w, x: Math.min(item.x, cols - w), y: item.y }
    while (next.y > 0 && !placed.some((p) => collides({ ...next, y: next.y - 1 }, p))) next.y--
    while (placed.some((p) => collides(next, p))) next.y++
    placed.push(next)
  }
  if (ids) {
    for (const id of ids) {
      if (placed.some((p) => p.i === id)) continue
      const bottom = placed.reduce((max, p) => Math.max(max, p.y + p.h), 0)
      placed.push({ i: id, x: 0, y: bottom, w: Math.min(2, cols), h: 2 })
    }
  }
  return placed
}

export function sizeOf(item: Pick<LayoutItem, 'w' | 'h'>): WidgetSize {
  if (item.h >= 6) return 'XL'
  if (item.h >= 4) return 'L'
  if (item.w >= 4) return 'M'
  return 'S'
}
