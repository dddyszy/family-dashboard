import {
  type AuthStatus,
  loginInput,
  type MeResponse,
  registerInput,
  setupInput,
  updateMeInput,
} from '@shared/schemas/users'
import { Hono } from 'hono'
import {
  clearAuthCookie,
  DEVICE_COOKIE,
  getAuthCookie,
  requireUser,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  setAuthCookie,
} from '../lib/auth'
import type { AppEnv } from '../lib/context'
import { tooManyRequests } from '../lib/errors'
import { RateLimiter } from '../lib/rate-limit'
import { clientKey } from '../lib/request'
import { readJson } from '../lib/validate'
import { login, logout, registerMember, setupAdmin } from '../services/auth'
import { getHousehold } from '../services/settings'
import { countUsers, toMe, updateMe } from '../services/users'

const loginLimiter = new RateLimiter(10, 60_000)
const registerLimiter = new RateLimiter(10, 60_000)

export const authRoutes = new Hono<AppEnv>()
  .get('/auth/status', (c) => {
    const initialized = countUsers(c.var.deps) > 0
    const status: AuthStatus = {
      initialized,
      registrationOpen: initialized && getHousehold(c.var.deps).allowRegistration,
    }
    return c.json(status)
  })
  .post('/auth/setup', async (c) => {
    const input = await readJson(c, setupInput)
    const { token, user } = await setupAdmin(c.var.deps, input, c.req.header('user-agent') ?? null)
    setAuthCookie(c, SESSION_COOKIE, token, SESSION_TTL_MS)
    const body: MeResponse = { kind: 'user', user: toMe(user) }
    return c.json(body)
  })
  .post('/auth/login', async (c) => {
    if (!loginLimiter.take(clientKey(c))) throw tooManyRequests('登录尝试过于频繁，请 1 分钟后再试')
    const input = await readJson(c, loginInput)
    const { token, user } = await login(c.var.deps, input, c.req.header('user-agent') ?? null)
    setAuthCookie(c, SESSION_COOKIE, token, SESSION_TTL_MS)
    const body: MeResponse = { kind: 'user', user: toMe(user) }
    return c.json(body)
  })
  .post('/auth/register', async (c) => {
    if (!registerLimiter.take(clientKey(c)))
      throw tooManyRequests('注册尝试过于频繁，请 1 分钟后再试')
    const input = await readJson(c, registerInput)
    const { token, user } = await registerMember(
      c.var.deps,
      input,
      c.req.header('user-agent') ?? null,
    )
    setAuthCookie(c, SESSION_COOKIE, token, SESSION_TTL_MS)
    c.var.deps.hub.broadcast('members.changed', {}, { kind: 'family' })
    const body: MeResponse = { kind: 'user', user: toMe(user) }
    return c.json(body, 201)
  })
  .post('/auth/logout', (c) => {
    const token = getAuthCookie(c, SESSION_COOKIE)
    if (token) logout(c.var.deps, token)
    clearAuthCookie(c, SESSION_COOKIE)
    clearAuthCookie(c, DEVICE_COOKIE)
    return c.json({ ok: true })
  })
  .get('/me', (c) => {
    const actor = c.var.actor
    let body: MeResponse
    if (!actor) body = { kind: 'anonymous' }
    else if (actor.kind === 'user') body = { kind: 'user', user: toMe(actor.user) }
    else body = { kind: 'device', device: { id: actor.device.id, name: actor.device.name } }
    return c.json(body)
  })
  .patch('/me', async (c) => {
    const user = requireUser(c)
    const input = await readJson(c, updateMeInput)
    const updated = await updateMe(c.var.deps, user, input, getAuthCookie(c, SESSION_COOKIE))
    if (input.name !== undefined || input.color !== undefined || input.avatar !== undefined) {
      c.var.deps.hub.broadcast('members.changed', {}, { kind: 'family' })
    }
    return c.json(toMe(updated))
  })
