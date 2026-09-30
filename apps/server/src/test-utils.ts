import { createApp } from './app'
import { createTestDb } from './db/client'
import type { Deps, UserRow } from './lib/context'
import { RealtimeHub } from './realtime/hub'
import { createUser } from './services/users'

export type TestClock = {
  now: () => number
  set: (ms: number) => void
  advance: (ms: number) => void
}

export function createClock(start = Date.UTC(2026, 9, 1, 0, 0, 0)): TestClock {
  let current = start
  return {
    now: () => current,
    set: (ms) => {
      current = ms
    },
    advance: (ms) => {
      current += ms
    },
  }
}

export function createTestDeps(clock: TestClock = createClock()): Deps {
  return { db: createTestDb(), hub: new RealtimeHub(), now: clock.now }
}

export async function seedUser(
  deps: Deps,
  username: string,
  role: 'admin' | 'member' = 'member',
): Promise<UserRow> {
  return createUser(deps, { username, name: username, password: 'secret123', role })
}

/** Minimal cookie-aware client around `app.request`, one per simulated browser. */
export function createClient(
  deps: Deps,
  defaultHeaders: Record<string, string> = {},
  options: { ip?: string } = {},
) {
  const app = createApp(deps, { reset: { backupDir: null, uploadsDir: null } })
  const { ip } = options
  // Stands in for the Bun server so rate limiting sees a socket address.
  const server = ip ? { requestIP: () => ({ address: ip }) } : undefined
  const cookies = new Map<string, string>()
  async function request(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = { ...defaultHeaders }
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (cookies.size) headers.cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    const res = await app.request(
      `/api${path}`,
      { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
      server,
    )
    for (const line of res.headers.getSetCookie()) {
      const [pair = ''] = line.split(';')
      const [name = '', value = ''] = pair.split('=')
      if (value && !/max-age=0/i.test(line)) cookies.set(name, value)
      else cookies.delete(name)
    }
    const text = await res.text()
    const json: unknown = text ? JSON.parse(text) : null
    return { status: res.status, json }
  }
  return {
    get: (path: string) => request('GET', path),
    post: (path: string, body?: unknown) => request('POST', path, body ?? {}),
    patch: (path: string, body: unknown) => request('PATCH', path, body),
    put: (path: string, body: unknown) => request('PUT', path, body),
    delete: (path: string) => request('DELETE', path),
    raw: app,
  }
}
