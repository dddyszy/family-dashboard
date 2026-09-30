import { FAMILY_DASHBOARD_ID } from '@shared/constants'
import { layoutsForSizes, pruneLayouts } from '@shared/layout'
import type { Dashboard, SaveDashboardInput, WidgetSize } from '@shared/schemas/dashboard'
import { eq } from 'drizzle-orm'
import { dashboards, widgets } from '../db/schema'
import type { Deps } from '../lib/context'
import { newId } from '../lib/crypto'
import { badRequest } from '../lib/errors'

type DefaultWidget = { type: string; size: WidgetSize; config?: Record<string, unknown> }

const DEFAULT_WIDGETS: DefaultWidget[] = [
  { type: 'clock.basic', size: 'M' },
  { type: 'weather.basic', size: 'M' },
  { type: 'calendar.members', size: 'XL' },
  { type: 'calendar.upcoming', size: 'L' },
  { type: 'shopping.pending', size: 'L' },
  { type: 'todos.open', size: 'M' },
  { type: 'calendar.next', size: 'S' },
  { type: 'shopping.count', size: 'S' },
]

function createDashboard(deps: Deps): void {
  const ts = deps.now()
  const items = DEFAULT_WIDGETS.map((d) => ({ ...d, id: newId() }))
  deps.db.transaction((tx) => {
    tx.insert(dashboards)
      .values({
        id: FAMILY_DASHBOARD_ID,
        layouts: layoutsForSizes(items),
        createdAt: ts,
        updatedAt: ts,
      })
      .run()
    for (const item of items) {
      tx.insert(widgets)
        .values({
          id: item.id,
          dashboardId: FAMILY_DASHBOARD_ID,
          type: item.type,
          config: item.config ?? {},
          createdAt: ts,
          updatedAt: ts,
        })
        .run()
    }
  })
}

function load(deps: Deps): Dashboard | null {
  const row = deps.db.select().from(dashboards).where(eq(dashboards.id, FAMILY_DASHBOARD_ID)).get()
  if (!row) return null
  const items = deps.db
    .select()
    .from(widgets)
    .where(eq(widgets.dashboardId, FAMILY_DASHBOARD_ID))
    .all()
  return {
    id: row.id,
    layouts: row.layouts,
    widgets: items.map((w) => ({ id: w.id, type: w.type, config: w.config })),
    updatedAt: row.updatedAt,
  }
}

/** The one dashboard the whole family shares, created with defaults on first access. */
export function getDashboard(deps: Deps): Dashboard {
  const existing = load(deps)
  if (existing) return existing
  createDashboard(deps)
  return load(deps) as Dashboard
}

export function saveDashboard(deps: Deps, input: SaveDashboardInput): Dashboard {
  const ids = input.widgets.map((w) => w.id)
  if (new Set(ids).size !== ids.length) throw badRequest('卡片 ID 重复')
  // Stray layout entries (e.g. of a just-removed widget) are harmless, so drop them instead of failing.
  const layouts = pruneLayouts(input.layouts, ids)
  getDashboard(deps)
  const ts = deps.now()
  deps.db.transaction((tx) => {
    tx.update(dashboards)
      .set({ layouts, updatedAt: ts })
      .where(eq(dashboards.id, FAMILY_DASHBOARD_ID))
      .run()
    tx.delete(widgets).where(eq(widgets.dashboardId, FAMILY_DASHBOARD_ID)).run()
    for (const w of input.widgets) {
      tx.insert(widgets)
        .values({
          id: w.id,
          dashboardId: FAMILY_DASHBOARD_ID,
          type: w.type,
          config: w.config,
          createdAt: ts,
          updatedAt: ts,
        })
        .run()
    }
  })
  return load(deps) as Dashboard
}
