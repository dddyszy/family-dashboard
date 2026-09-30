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

export function sizeOf(item: Pick<LayoutItem, 'w' | 'h'>): WidgetSize {
  if (item.h >= 6) return 'XL'
  if (item.h >= 4) return 'L'
  if (item.w >= 4) return 'M'
  return 'S'
}
