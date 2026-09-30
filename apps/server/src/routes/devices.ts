import { Hono } from 'hono'
import { z } from 'zod'
import { DEVICE_COOKIE, DEVICE_TTL_MS, requireAdmin, setAuthCookie } from '../lib/auth'
import type { AppEnv } from '../lib/context'
import { tooManyRequests } from '../lib/errors'
import { RateLimiter } from '../lib/rate-limit'
import { clientKey } from '../lib/request'
import { readJson } from '../lib/validate'
import { createPairingCode, listDevices, pairDevice, revokeDevice } from '../services/devices'

const pairLimiter = new RateLimiter(10, 60_000)

const pairInput = z.object({
  code: z.string().regex(/^\d{6}$/, '配对码为 6 位数字'),
  name: z.string().trim().min(1, '请输入设备名称').max(32),
})

export const deviceRoutes = new Hono<AppEnv>()
  .get('/devices', (c) => {
    requireAdmin(c)
    return c.json(listDevices(c.var.deps))
  })
  .post('/devices/pairing-code', (c) => {
    requireAdmin(c)
    return c.json(createPairingCode(c.var.deps))
  })
  .post('/devices/pair', async (c) => {
    if (!pairLimiter.take(clientKey(c))) throw tooManyRequests()
    const input = await readJson(c, pairInput)
    const { token, device } = pairDevice(c.var.deps, input.code, input.name)
    setAuthCookie(c, DEVICE_COOKIE, token, DEVICE_TTL_MS)
    return c.json(device)
  })
  .delete('/devices/:id', (c) => {
    requireAdmin(c)
    revokeDevice(c.var.deps, c.req.param('id'))
    return c.json({ ok: true })
  })
