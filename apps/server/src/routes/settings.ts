import { updateSettingsInput } from '@shared/schemas/settings'
import { Hono } from 'hono'
import { requireActor, requireAdmin } from '../lib/auth'
import type { AppEnv } from '../lib/context'
import { readJson } from '../lib/validate'
import { getHousehold, updateHousehold } from '../services/settings'

export const settingsRoutes = new Hono<AppEnv>()
  .get('/settings', (c) => {
    requireActor(c)
    return c.json(getHousehold(c.var.deps))
  })
  .patch('/settings', async (c) => {
    requireAdmin(c)
    const input = await readJson(c, updateSettingsInput)
    const next = updateHousehold(c.var.deps, input)
    c.var.deps.hub.broadcast('settings.changed', {}, { kind: 'family' })
    return c.json(next)
  })
