import { FAMILY_DASHBOARD_ID } from '@shared/constants'
import { saveDashboardInput } from '@shared/schemas/dashboard'
import { Hono } from 'hono'
import { buildHome } from '../home/registry'
import { requireActor, requireUser, requireViewer } from '../lib/auth'
import type { AppEnv } from '../lib/context'
import { forbidden } from '../lib/errors'
import { readJson } from '../lib/validate'
import {
  getDashboardOwner,
  getFamilyDashboard,
  getMyDashboard,
  saveDashboard,
} from '../services/dashboards'
import { getWeather } from '../services/weather'

export const dashboardRoutes = new Hono<AppEnv>()
  .get('/dashboards/mine', (c) => {
    const user = requireUser(c)
    return c.json(getMyDashboard(c.var.deps, user.id))
  })
  .get('/dashboards/family', (c) => {
    requireActor(c)
    return c.json(getFamilyDashboard(c.var.deps))
  })
  .put('/dashboards/:id', async (c) => {
    const user = requireUser(c)
    const id = c.req.param('id')
    const { userId } = getDashboardOwner(c.var.deps, id)
    const allowed = id === FAMILY_DASHBOARD_ID ? user.role === 'admin' : userId === user.id
    if (!allowed) {
      throw forbidden(
        id === FAMILY_DASHBOARD_ID ? '只有管理员可以编辑家庭大屏' : '不能编辑别人的首页',
      )
    }
    const input = await readJson(c, saveDashboardInput)
    const dashboard = saveDashboard(c.var.deps, id, input)
    if (id === FAMILY_DASHBOARD_ID) {
      c.var.deps.hub.broadcast('dashboard.changed', { dashboardId: id }, { kind: 'family' })
    }
    return c.json(dashboard)
  })
  .get('/home', (c) => {
    const viewer = requireViewer(c)
    return c.json(buildHome({ deps: c.var.deps, viewer }))
  })
  .get('/weather', async (c) => {
    requireActor(c)
    return c.json(await getWeather(c.var.deps))
  })
