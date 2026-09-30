import { describe, expect, test } from 'bun:test'
import { createApp } from '../app'
import { env } from '../env'
import { createPairingCode } from '../services/devices'
import { createTestDeps, seedUser } from '../test-utils'

type Transport = 'http' | 'https' | 'proxy'

function requestOptions(transport: Transport, cookie = '', body?: unknown): RequestInit {
  return {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      host: 'dash.test',
      origin: `${transport === 'http' ? 'http' : 'https'}://dash.test`,
      ...(transport === 'proxy'
        ? { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'dash.test' }
        : {}),
      'content-type': 'application/json',
      cookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }
}

function cookieFrom(response: Response): string {
  return (
    response.headers
      .getSetCookie()
      .find((line) => line.includes('Max-Age='))
      ?.split(';')[0] ?? ''
  )
}

describe('HTTP and HTTPS authentication', () => {
  test('keeps separate sessions on the same host with PUBLIC_URL configured', async () => {
    const previous = env.publicUrl
    env.publicUrl = 'https://dash.test'
    try {
      const deps = createTestDeps()
      await seedUser(deps, 'dad', 'admin')
      await seedUser(deps, 'mom')
      const app = createApp(deps)
      const http = await app.request(
        'http://dash.test/api/auth/login',
        requestOptions('http', '', { username: 'dad', password: 'secret123' }),
      )
      expect(http.status).toBe(200)
      expect(http.headers.get('set-cookie')).toContain('fd_session_http=')
      expect(http.headers.get('set-cookie')).not.toContain('; Secure')
      const https = await app.request(
        'http://dash.test/api/auth/login',
        requestOptions('proxy', '', { username: 'mom', password: 'secret123' }),
      )
      expect(https.status).toBe(200)
      expect(https.headers.get('set-cookie')).toContain('__Secure-fd_session=')
      expect(https.headers.get('set-cookie')).toContain('; Secure')
      for (const response of [http, https]) {
        expect(response.headers.get('set-cookie')).toContain('HttpOnly')
        expect(response.headers.get('set-cookie')).toContain('SameSite=Lax')
      }
      const cookies = `${cookieFrom(http)}; ${cookieFrom(https)}`
      for (const [transport, username] of [
        ['http', 'dad'],
        ['proxy', 'mom'],
      ] as const) {
        const me = await app.request('http://dash.test/api/me', requestOptions(transport, cookies))
        expect(await me.json()).toMatchObject({ kind: 'user', user: { username } })
      }
      const logout = await app.request(
        'http://dash.test/api/auth/logout',
        requestOptions('http', cookies, {}),
      )
      expect(logout.status).toBe(200)
      expect(logout.headers.get('set-cookie')).not.toContain('__Secure-fd_session')
      const signedOut = await app.request(
        'http://dash.test/api/me',
        requestOptions('http', cookies),
      )
      expect(await signedOut.json()).toEqual({ kind: 'anonymous' })
      const stillSignedIn = await app.request(
        'http://dash.test/api/me',
        requestOptions('proxy', cookies),
      )
      expect(await stillSignedIn.json()).toMatchObject({ kind: 'user', user: { username: 'mom' } })
    } finally {
      env.publicUrl = previous
    }
  })

  test('native HTTPS sets and clears Secure cookies without PUBLIC_URL', async () => {
    const deps = createTestDeps()
    const app = createApp(deps)
    const response = await app.request(
      'https://dash.test/api/auth/setup',
      requestOptions('https', '', {
        username: 'dad',
        name: '爸爸',
        password: 'secret123',
      }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('__Secure-fd_session=')
    expect(response.headers.get('set-cookie')).toContain('; Secure')
    const logout = await app.request(
      'https://dash.test/api/auth/logout',
      requestOptions('https', cookieFrom(response), {}),
    )
    expect(logout.headers.get('set-cookie')).toContain('__Secure-fd_session=;')
    expect(logout.headers.get('set-cookie')).toContain('; Secure')
  })

  test('pairs devices on both transports and resolves the matching cookie', async () => {
    const deps = createTestDeps()
    const app = createApp(deps)
    const cookies: string[] = []
    for (const transport of ['http', 'proxy'] as const) {
      const { code } = createPairingCode(deps)
      const response = await app.request(
        'http://dash.test/api/devices/pair',
        requestOptions(transport, '', {
          code,
          name: transport,
        }),
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('set-cookie')).toContain(
        transport === 'http' ? 'fd_device_http=' : '__Secure-fd_device=',
      )
      cookies.push(cookieFrom(response))
    }
    for (const transport of ['http', 'proxy'] as const) {
      const response = await app.request(
        'http://dash.test/api/me',
        requestOptions(transport, cookies.join('; ')),
      )
      expect(await response.json()).toMatchObject({ kind: 'device', device: { name: transport } })
    }
  })

  test('accepts legacy sessions and revokes them on logout', async () => {
    const deps = createTestDeps()
    await seedUser(deps, 'dad', 'admin')
    const app = createApp(deps)
    const response = await app.request(
      'http://dash.test/api/auth/login',
      requestOptions('http', '', {
        username: 'dad',
        password: 'secret123',
      }),
    )
    const legacy = cookieFrom(response).replace('fd_session_http=', 'fd_session=')
    const me = await app.request('http://dash.test/api/me', requestOptions('http', legacy))
    expect(await me.json()).toMatchObject({ kind: 'user' })
    await app.request('http://dash.test/api/auth/logout', requestOptions('http', legacy, {}))
    const signedOut = await app.request('http://dash.test/api/me', requestOptions('http', legacy))
    expect(await signedOut.json()).toEqual({ kind: 'anonymous' })
  })

  test('checks origin protocol and host while allowing both direct and proxied access', async () => {
    const deps = createTestDeps()
    const app = createApp(deps)
    for (const transport of ['http', 'proxy'] as const) {
      const response = await app.request(
        'http://dash.test/api/auth/logout',
        requestOptions(transport, '', {}),
      )
      expect(response.status).toBe(200)
    }
    for (const origin of [
      'https://evil.test',
      'null',
      'http://dash.test',
      'https://dash.test/path',
    ]) {
      const options = requestOptions('proxy', '', {})
      const headers = new Headers(options.headers)
      headers.set('origin', origin)
      const response = await app.request('http://dash.test/api/auth/logout', {
        ...options,
        headers,
      })
      expect(response.status).toBe(403)
    }
  })
})
