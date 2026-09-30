import { resetInput } from '@shared/schemas/admin'
import { Hono } from 'hono'
import { clearAuthCookie, DEVICE_COOKIE, requireAdmin, SESSION_COOKIE } from '../lib/auth'
import type { AppEnv } from '../lib/context'
import { tooManyRequests } from '../lib/errors'
import { RateLimiter } from '../lib/rate-limit'
import { clientKey } from '../lib/request'
import { readJson } from '../lib/validate'
import { type ResetOptions, resetData } from '../services/reset'

const resetLimiter = new RateLimiter(5, 60_000)

export function createAdminRoutes(resetOptions: ResetOptions = {}) {
  return new Hono<AppEnv>().post('/admin/reset', async (c) => {
    const admin = requireAdmin(c)
    if (!resetLimiter.take(clientKey(c))) throw tooManyRequests()
    const input = await readJson(c, resetInput)
    const result = await resetData(c.var.deps, admin, input.mode, input.password, resetOptions)
    if (result.mode === 'factory') {
      clearAuthCookie(c, SESSION_COOKIE)
      clearAuthCookie(c, DEVICE_COOKIE)
    }
    return c.json(result)
  })
}
