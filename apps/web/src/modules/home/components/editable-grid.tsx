import { pruneLayouts, sizeOf } from '@shared/layout'
import {
  BREAKPOINT_COLS,
  BREAKPOINT_WIDTHS,
  BREAKPOINTS,
  type BreakpointName,
  type LayoutItem,
  type Layouts,
  type WidgetInstance,
  type WidgetSize,
} from '@shared/schemas/dashboard'
import { useMemo, useState } from 'react'
import { type Layout, ResponsiveGridLayout, type ResponsiveLayouts } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { getWidget } from '@/widgets/registry'
import { WidgetFrame } from '@/widgets/widget-frame'
import { breakpointFor, GRID_MARGIN, rowHeightFor } from './grid-shared'

export type EditableGridProps = {
  width: number
  layouts: Layouts
  widgets: WidgetInstance[]
  onLayoutsChange: (layouts: Layouts) => void
  onRemove: (id: string) => void
  onResize: (id: string, size: WidgetSize) => void
  onConfigure: (id: string) => void
}

function toItems(layout: Layout | undefined): LayoutItem[] {
  return (layout ?? []).map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))
}

/** Drag-and-drop grid, loaded only when the user enters edit mode. */
export function EditableGrid({
  width,
  layouts,
  widgets,
  onLayoutsChange,
  onRemove,
  onResize,
  onConfigure,
}: EditableGridProps) {
  const [breakpoint, setBreakpoint] = useState<BreakpointName>(() => breakpointFor(width))
  const itemsById = useMemo(
    () => new Map(layouts[breakpoint].map((item) => [item.i, item])),
    [layouts, breakpoint],
  )

  const handleLayoutChange = (_layout: Layout, all: ResponsiveLayouts<BreakpointName>) => {
    const next: Layouts = { ...layouts }
    for (const bp of BREAKPOINTS) {
      if (all[bp]) next[bp] = toItems(all[bp])
    }
    // The grid caches layouts for breakpoints not on screen, which still contain removed widgets.
    onLayoutsChange(
      pruneLayouts(
        next,
        widgets.map((w) => w.id),
      ),
    )
  }

  return (
    <ResponsiveGridLayout<BreakpointName>
      width={width}
      breakpoints={BREAKPOINT_WIDTHS}
      cols={BREAKPOINT_COLS}
      layouts={layouts}
      rowHeight={rowHeightFor(width, breakpoint)}
      margin={[GRID_MARGIN, GRID_MARGIN]}
      containerPadding={[0, 0]}
      dragConfig={{ enabled: true, threshold: 6, cancel: '.no-drag' }}
      resizeConfig={{ enabled: false }}
      onBreakpointChange={(bp) => setBreakpoint(bp)}
      onLayoutChange={handleLayoutChange}
    >
      {widgets.map((w) => {
        const item = itemsById.get(w.id)
        return (
          <div key={w.id}>
            <WidgetFrame
              definition={getWidget(w.type)}
              instanceId={w.id}
              config={w.config}
              size={item ? sizeOf(item) : 'S'}
              editMode
              onRemove={() => onRemove(w.id)}
              onResize={(s) => onResize(w.id, s)}
              onConfigure={() => onConfigure(w.id)}
            />
          </div>
        )
      })}
    </ResponsiveGridLayout>
  )
}
