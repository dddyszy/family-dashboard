import { saveDashboardInput } from '@shared/schemas/dashboard'
import { Hono } from 'hono'
import { buildHome } from '../home/registry'
import { requireActor, requireUser, requireViewer } from '../lib/auth'
import type { AppEnv } from '../lib/context'
import { readJson } from '../lib/validate'
import { getDashboard, saveDashboard } from '../services/dashboards'
import { getWeather } from '../services/weather'

export const dashboardRoutes = new Hono<AppEnv>()
  .get('/dashboard', (c) => {
    requireActor(c)
    return c.json(getDashboard(c.var.deps))
  })
  .put('/dashboard', async (c) => {
    requireUser(c)
    const input = await readJson(c, saveDashboardInput)
    const dashboard = saveDashboard(c.var.deps, input)
    c.var.deps.hub.broadcast('dashboard.changed', { dashboardId: dashboard.id }, { kind: 'family' })
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
