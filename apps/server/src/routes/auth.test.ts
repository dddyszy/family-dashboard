import { describe, expect, test } from 'bun:test'
import { createClient, createTestDeps } from '../test-utils'

describe('auth flow', () => {
  test('setup creates the first admin once', async () => {
    const deps = createTestDeps()
    const client = createClient(deps)
    expect((await client.get('/auth/status')).json).toEqual({ initialized: false })

    const setup = await client.post('/auth/setup', {
      username: 'Dad',
      name: '爸爸',
      password: 'secret123',
    })
    expect(setup.status).toBe(200)
    expect(setup.json).toMatchObject({ kind: 'user', user: { username: 'dad', role: 'admin' } })
    expect((await client.get('/auth/status')).json).toEqual({ initialized: true })

    const again = await createClient(deps).post('/auth/setup', {
      username: 'mom',
      name: '妈妈',
      password: 'secret123',
    })
    expect(again.status).toBe(409)
  })

  test('login, me and logout', async () => {
    const deps = createTestDeps()
    const admin = createClient(deps)
    await admin.post('/auth/setup', { username: 'dad', name: '爸爸', password: 'secret123' })
    await admin.post('/users', { username: 'mom', name: '妈妈', password: 'secret456' })

    const mom = createClient(deps)
    expect((await mom.get('/me')).json).toEqual({ kind: 'anonymous' })
    expect((await mom.post('/auth/login', { username: 'mom', password: 'wrong!' })).status).toBe(
      400,
    )
    const ok = await mom.post('/auth/login', { username: 'MOM', password: 'secret456' })
    expect(ok.status).toBe(200)
    expect((await mom.get('/me')).json).toMatchObject({ kind: 'user', user: { name: '妈妈' } })

    await mom.post('/auth/logout')
    expect((await mom.get('/me')).json).toEqual({ kind: 'anonymous' })
  })

  test('members cannot manage users', async () => {
    const deps = createTestDeps()
    const admin = createClient(deps)
    await admin.post('/auth/setup', { username: 'dad', name: '爸爸', password: 'secret123' })
    await admin.post('/users', { username: 'kid', name: '小明', password: 'secret456' })
    const kid = createClient(deps)
    await kid.post('/auth/login', { username: 'kid', password: 'secret456' })
    const res = await kid.post('/users', { username: 'x1', name: 'x', password: 'secret456' })
    expect(res.status).toBe(403)
    expect(res.json).toMatchObject({ error: { code: 'FORBIDDEN' } })
  })

  test('rejects cross-origin writes', async () => {
    const deps = createTestDeps()
    const { raw } = createClient(deps)
    const res = await raw.request('/api/auth/login', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
        host: 'dash.local',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ username: 'a', password: 'b' }),
    })
    expect(res.status).toBe(403)
  })

  test('device pairing yields a read-only actor', async () => {
    const deps = createTestDeps()
    const admin = createClient(deps)
    await admin.post('/auth/setup', { username: 'dad', name: '爸爸', password: 'secret123' })
    const { json } = await admin.post('/devices/pairing-code')
    const code = (json as { code: string }).code

    const kiosk = createClient(deps)
    expect((await kiosk.post('/devices/pair', { code, name: '客厅' })).status).toBe(200)
    expect((await kiosk.get('/me')).json).toMatchObject({
      kind: 'device',
      device: { name: '客厅' },
    })
    expect((await kiosk.patch('/me', { name: 'x' })).status).toBe(403)
    expect((await createClient(deps).post('/devices/pair', { code, name: '重复' })).status).toBe(
      400,
    )
  })
})
