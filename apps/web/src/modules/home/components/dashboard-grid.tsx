import { compactLayout, sizeOf } from '@shared/layout'
import {
  BREAKPOINT_COLS,
  type Layouts,
  type WidgetInstance,
  type WidgetSize,
} from '@shared/schemas/dashboard'
import { lazy, Suspense, useMemo } from 'react'
import { Spinner } from '@/components/button'
import { getWidget } from '@/widgets/registry'
import { WidgetFrame } from '@/widgets/widget-frame'
import { breakpointFor, GRID_MARGIN, rowHeightFor, useElementWidth } from './grid-shared'

const EditableGrid = lazy(() =>
  import('./editable-grid').then((m) => ({ default: m.EditableGrid })),
)

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

/**
 * Viewing uses a plain CSS grid so the drag-and-drop library is never downloaded unless someone
 * edits the layout. Both render identical geometry.
 */
export function DashboardGrid(props: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>()
  return (
    <div ref={ref} className="min-h-40">
      {width === 0 ? null : props.editMode ? (
        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <Spinner className="text-fg-subtle" />
            </div>
          }
        >
          <EditableGrid
            width={width}
            layouts={props.layouts}
            widgets={props.widgets}
            onLayoutsChange={props.onLayoutsChange ?? (() => {})}
            onRemove={props.onRemove ?? (() => {})}
            onResize={props.onResize ?? (() => {})}
            onConfigure={props.onConfigure ?? (() => {})}
          />
        </Suspense>
      ) : (
        <StaticGrid
          width={width}
          layouts={props.layouts}
          widgets={props.widgets}
          readOnly={props.readOnly}
        />
      )}
    </div>
  )
}

function StaticGrid({
  width,
  layouts,
  widgets,
  readOnly,
}: {
  width: number
  layouts: Layouts
  widgets: WidgetInstance[]
  readOnly?: boolean
}) {
  const breakpoint = breakpointFor(width)
  const cols = BREAKPOINT_COLS[breakpoint]
  const items = useMemo(
    () =>
      compactLayout(
        layouts[breakpoint],
        cols,
        widgets.map((w) => w.id),
      ),
    [layouts, breakpoint, cols, widgets],
  )
  const byId = new Map(widgets.map((w) => [w.id, w]))

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridAutoRows: `${rowHeightFor(width, breakpoint)}px`,
        gap: GRID_MARGIN,
      }}
    >
      {items.map((item) => {
        const widget = byId.get(item.i)
        if (!widget) return null
        return (
          <div
            key={item.i}
            className="animate-fade-in"
            style={{
              gridColumn: `${item.x + 1} / span ${item.w}`,
              gridRow: `${item.y + 1} / span ${item.h}`,
            }}
          >
            <WidgetFrame
              definition={getWidget(widget.type)}
              instanceId={widget.id}
              config={widget.config}
              size={sizeOf(item)}
              editMode={false}
              readOnly={readOnly}
            />
          </div>
        )
      })}
    </div>
  )
}
