import { sizeOf } from '@shared/layout'
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
import {
  getBreakpointFromWidth,
  type Layout,
  ResponsiveGridLayout,
  type ResponsiveLayouts,
  useContainerWidth,
} from 'react-grid-layout'
import { getWidget } from '@/widgets/registry'
import { WidgetFrame } from '@/widgets/widget-frame'

const MARGIN = 16

type Props = {
  layouts: Layouts
  widgets: WidgetInstance[]
  editMode: boolean
  readOnly?: boolean
  onLayoutsChange?: (layouts: Layouts) => void
  onRemove?: (id: string) => void
  onResize?: (id: string, size: WidgetSize) => void
  onConfigure?: (id: string) => void
}

function toItems(layout: Layout | undefined): LayoutItem[] {
  return (layout ?? []).map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))
}

export function DashboardGrid({
  layouts,
  widgets,
  editMode,
  readOnly,
  onLayoutsChange,
  onRemove,
  onResize,
  onConfigure,
}: Props) {
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1024 })
  const [breakpoint, setBreakpoint] = useState<BreakpointName>(
    () => getBreakpointFromWidth(BREAKPOINT_WIDTHS, width) as BreakpointName,
  )
  const cols = BREAKPOINT_COLS[breakpoint]
  const rowHeight = Math.max(60, (width - MARGIN * (cols - 1)) / cols)

  const itemsById = useMemo(() => {
    const current = layouts[breakpoint]
    return new Map(current.map((item) => [item.i, item]))
  }, [layouts, breakpoint])

  const handleLayoutChange = (_layout: Layout, all: ResponsiveLayouts<BreakpointName>) => {
    if (!editMode || !onLayoutsChange) return
    const next: Layouts = { ...layouts }
    for (const bp of BREAKPOINTS) {
      if (all[bp]) next[bp] = toItems(all[bp])
    }
    onLayoutsChange(next)
  }

  return (
    <div ref={containerRef} className="min-h-40">
      {mounted ? (
        <ResponsiveGridLayout<BreakpointName>
          width={width}
          breakpoints={BREAKPOINT_WIDTHS}
          cols={BREAKPOINT_COLS}
          layouts={layouts}
          rowHeight={rowHeight}
          margin={[MARGIN, MARGIN]}
          containerPadding={[0, 0]}
          dragConfig={{ enabled: editMode, threshold: 6, cancel: '.no-drag' }}
          resizeConfig={{ enabled: false }}
          onBreakpointChange={(bp) => setBreakpoint(bp)}
          onLayoutChange={handleLayoutChange}
        >
          {widgets.map((w) => {
            const item = itemsById.get(w.id)
            const size = item ? sizeOf(item) : 'S'
            return (
              <div key={w.id}>
                <WidgetFrame
                  definition={getWidget(w.type)}
                  instanceId={w.id}
                  config={w.config}
                  size={size}
                  editMode={editMode}
                  readOnly={readOnly}
                  onRemove={() => onRemove?.(w.id)}
                  onResize={(s) => onResize?.(w.id, s)}
                  onConfigure={() => onConfigure?.(w.id)}
                />
              </div>
            )
          })}
        </ResponsiveGridLayout>
      ) : null}
    </div>
  )
}
