import { FAMILY_DASHBOARD_ID } from '@shared/constants'
import { layoutsForSizes } from '@shared/layout'
import type { Dashboard, SaveDashboardInput, WidgetSize } from '@shared/schemas/dashboard'
import { eq } from 'drizzle-orm'
import { dashboards, widgets } from '../db/schema'
import type { Deps } from '../lib/context'
import { newId } from '../lib/crypto'
import { badRequest, notFound } from '../lib/errors'

type DefaultWidget = { type: string; size: WidgetSize; config?: Record<string, unknown> }

const PERSONAL_DEFAULTS: DefaultWidget[] = [
  { type: 'clock.basic', size: 'S' },
  { type: 'weather.basic', size: 'S' },
  { type: 'calendar.today', size: 'L' },
  { type: 'shopping.pending', size: 'L' },
  { type: 'calendar.upcoming', size: 'L' },
  { type: 'todos.open', size: 'M' },
  { type: 'calendar.next', size: 'S' },
  { type: 'shopping.count', size: 'S' },
]

const FAMILY_DEFAULTS: DefaultWidget[] = [
  { type: 'clock.basic', size: 'M' },
  { type: 'weather.basic', size: 'M' },
  { type: 'calendar.members', size: 'XL' },
  { type: 'calendar.upcoming', size: 'L' },
  { type: 'shopping.pending', size: 'L' },
  { type: 'todos.open', size: 'M' },
  { type: 'calendar.next', size: 'S' },
  { type: 'shopping.count', size: 'S' },
]

function createDashboard(
  deps: Deps,
  id: string,
  userId: string | null,
  defaults: DefaultWidget[],
): void {
  const ts = deps.now()
  const items = defaults.map((d) => ({ ...d, id: newId() }))
  deps.db.transaction((tx) => {
    tx.insert(dashboards)
      .values({ id, userId, layouts: layoutsForSizes(items), createdAt: ts, updatedAt: ts })
      .run()
    for (const item of items) {
      tx.insert(widgets)
        .values({
          id: item.id,
          dashboardId: id,
          type: item.type,
          config: item.config ?? {},
          createdAt: ts,
          updatedAt: ts,
        })
        .run()
    }
  })
}

function load(deps: Deps, id: string): Dashboard | null {
  const row = deps.db.select().from(dashboards).where(eq(dashboards.id, id)).get()
  if (!row) return null
  const items = deps.db.select().from(widgets).where(eq(widgets.dashboardId, id)).all()
  return {
    id: row.id,
    userId: row.userId,
    layouts: row.layouts,
    widgets: items.map((w) => ({ id: w.id, type: w.type, config: w.config })),
    updatedAt: row.updatedAt,
  }
}

export function getMyDashboard(deps: Deps, userId: string): Dashboard {
  const existing = deps.db.select().from(dashboards).where(eq(dashboards.userId, userId)).get()
  if (existing) return load(deps, existing.id) as Dashboard
  const id = newId()
  createDashboard(deps, id, userId, PERSONAL_DEFAULTS)
  return load(deps, id) as Dashboard
}

export function getFamilyDashboard(deps: Deps): Dashboard {
  const existing = load(deps, FAMILY_DASHBOARD_ID)
  if (existing) return existing
  createDashboard(deps, FAMILY_DASHBOARD_ID, null, FAMILY_DEFAULTS)
  return load(deps, FAMILY_DASHBOARD_ID) as Dashboard
}

export function getDashboardOwner(deps: Deps, id: string): { userId: string | null } {
  const row = deps.db
    .select({ userId: dashboards.userId })
    .from(dashboards)
    .where(eq(dashboards.id, id))
    .get()
  if (!row) throw notFound('看板不存在')
  return row
}

export function saveDashboard(deps: Deps, id: string, input: SaveDashboardInput): Dashboard {
  const ids = new Set(input.widgets.map((w) => w.id))
  for (const bp of ['lg', 'md', 'sm'] as const) {
    if (input.layouts[bp].some((item) => !ids.has(item.i))) throw badRequest('布局中存在未知的卡片')
  }
  const ts = deps.now()
  deps.db.transaction((tx) => {
    tx.update(dashboards)
      .set({ layouts: input.layouts, updatedAt: ts })
      .where(eq(dashboards.id, id))
      .run()
    tx.delete(widgets).where(eq(widgets.dashboardId, id)).run()
    for (const w of input.widgets) {
      tx.insert(widgets)
        .values({
          id: w.id,
          dashboardId: id,
          type: w.type,
          config: w.config,
          createdAt: ts,
          updatedAt: ts,
        })
        .run()
    }
  })
  return load(deps, id) as Dashboard
}
