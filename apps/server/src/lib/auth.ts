import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { env } from '../env'
import { resolveSession } from '../services/auth'
import { resolveDevice } from '../services/devices'
import type { Actor, AppEnv, DeviceRow, UserRow } from './context'
import { viewerOf } from './context'
import { forbidden, unauthorized } from './errors'
import type { Viewer } from './visibility'

export const SESSION_COOKIE = 'fd_session'
export const DEVICE_COOKIE = 'fd_device'
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const DEVICE_TTL_MS = 400 * 24 * 60 * 60 * 1000

function isSecure(c: Context): boolean {
  return new URL(c.req.url).protocol === 'https:' || c.req.header('x-forwarded-proto') === 'https'
}

type AuthCookie = typeof SESSION_COOKIE | typeof DEVICE_COOKIE

function authCookieName(c: Context, name: AuthCookie): string {
  // Separate names let the same host serve HTTP and HTTPS without overwriting a Secure cookie.
  return isSecure(c) ? `__Secure-${name}` : `${name}_http`
}

export function getAuthCookie(c: Context, name: AuthCookie): string | undefined {
  return getCookie(c, authCookieName(c, name)) ?? getCookie(c, name)
}

export function setAuthCookie(c: Context, name: AuthCookie, token: string, ttlMs: number): void {
  if (getCookie(c, name)) deleteCookie(c, name, { path: '/', secure: isSecure(c) })
  setCookie(c, authCookieName(c, name), token, {
    httpOnly: true,
    secure: isSecure(c),
    sameSite: 'Lax',
    path: '/',
    maxAge: Math.floor(ttlMs / 1000),
  })
}

export function clearAuthCookie(c: Context, name: AuthCookie): void {
  deleteCookie(c, authCookieName(c, name), { path: '/', secure: isSecure(c) })
  deleteCookie(c, name, { path: '/', secure: isSecure(c) })
}

export const authenticate: MiddlewareHandler<AppEnv> = async (c, next) => {
  const { deps } = c.var
  let actor: Actor | null = null
  const sessionToken = getAuthCookie(c, SESSION_COOKIE)
  if (sessionToken) {
    const user = resolveSession(deps, sessionToken)
    if (user) actor = { kind: 'user', user }
  }
  if (!actor) {
    const deviceToken = getAuthCookie(c, DEVICE_COOKIE)
    if (deviceToken) {
      const device = resolveDevice(deps, deviceToken)
      if (device) actor = { kind: 'device', device }
    }
  }
  c.set('actor', actor)
  await next()
}

/** Rejects cross-site writes: browsers always send Origin on non-GET fetches. */
export const originGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  const method = c.req.method
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const origin = c.req.header('origin')
    if (origin && !isAllowedOrigin(c, origin)) throw forbidden('请求来源不被允许')
  }
  await next()
}

function isAllowedOrigin(c: Context, origin: string): boolean {
  if (env.publicUrl && origin === new URL(env.publicUrl).origin) return true
  const host = c.req.header('x-forwarded-host') ?? c.req.header('host')
  if (!host) return false
  try {
    return origin === new URL(`${isSecure(c) ? 'https' : 'http'}://${host}`).origin
  } catch {
    return false
  }
}

export function requireActor(c: Context<AppEnv>): Actor {
  const actor = c.var.actor
  if (!actor) throw unauthorized()
  return actor
}

export function requireViewer(c: Context<AppEnv>): Viewer {
  return viewerOf(requireActor(c))
}

export function requireUser(c: Context<AppEnv>): UserRow {
  const actor = requireActor(c)
  if (actor.kind !== 'user') throw forbidden('大屏设备为只读模式')
  return actor.user
}

export function requireAdmin(c: Context<AppEnv>): UserRow {
  const user = requireUser(c)
  if (user.role !== 'admin') throw forbidden('只有管理员可以执行此操作')
  return user
}

export function requireDevice(c: Context<AppEnv>): DeviceRow {
  const actor = requireActor(c)
  if (actor.kind !== 'device') throw forbidden()
  return actor.device
}
