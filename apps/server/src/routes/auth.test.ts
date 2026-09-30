import { describe, expect, test } from 'bun:test'
import { updateHousehold } from '../services/settings'
import { countUsers, listUsers } from '../services/users'
import { createClient, createTestDeps, seedUser } from '../test-utils'

describe('auth flow', () => {
  test('setup creates the first admin once', async () => {
    const deps = createTestDeps()
    const client = createClient(deps)
    expect((await client.get('/auth/status')).json).toEqual({
      initialized: false,
      registrationOpen: false,
    })

    const setup = await client.post('/auth/setup', {
      username: 'Dad',
      name: '爸爸',
      password: 'secret123',
    })
    expect(setup.status).toBe(200)
    expect(setup.json).toMatchObject({ kind: 'user', user: { username: 'dad', role: 'admin' } })
    expect((await client.get('/auth/status')).json).toEqual({
      initialized: true,
      registrationOpen: false,
    })

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

  test('concurrent setup creates exactly one administrator', async () => {
    const deps = createTestDeps()
    const results = await Promise.all(
      ['dad', 'mom'].map((username) =>
        createClient(deps).post('/auth/setup', { username, name: username, password: 'secret123' }),
      ),
    )
    expect(results.map((result) => result.status).sort()).toEqual([200, 409])
    expect(listUsers(deps).map((user) => user.role)).toEqual(['admin'])
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

describe('member registration', () => {
  test('requires administrator initialization before registration', async () => {
    const deps = createTestDeps()
    const client = createClient(deps, {}, { ip: '192.0.2.1' })
    const result = await client.post('/auth/register', {
      username: 'mom',
      name: '妈妈',
      password: 'secret123',
    })
    expect(result.status).toBe(409)
    expect(result.json).toMatchObject({
      error: { code: 'CONFLICT', message: '请先创建管理员账号' },
    })
    expect(countUsers(deps)).toBe(0)
    expect((await client.get('/me')).json).toEqual({ kind: 'anonymous' })
  })

  test('registers and signs in a member, ignores a forged role and broadcasts the change', async () => {
    const deps = createTestDeps()
    const admin = await seedUser(deps, 'dad', 'admin')
    updateHousehold(deps, { allowRegistration: true })
    const events: string[] = []
    const unsubscribe = deps.hub.add({ kind: 'user', userId: admin.id }, (event) =>
      events.push(event),
    )
    const member = createClient(deps, {}, { ip: '192.0.2.2' })
    const result = await member.post('/auth/register', {
      username: '  MOM  ',
      name: ' 妈妈 ',
      password: 'secret123',
      role: 'admin',
    })
    expect(result.status).toBe(201)
    expect(result.json).toMatchObject({
      kind: 'user',
      user: { username: 'mom', name: '妈妈', role: 'member' },
    })
    expect(JSON.stringify(result.json)).not.toContain('passwordHash')
    expect((await member.get('/me')).json).toMatchObject({ kind: 'user', user: { role: 'member' } })
    expect(
      (await member.post('/users', { username: 'kid', name: '孩子', password: 'secret123' }))
        .status,
    ).toBe(403)
    expect((await member.patch('/me', { role: 'admin' })).json).toMatchObject({ role: 'member' })
    expect(events).toEqual(['members.changed'])
    unsubscribe()
    await member.post('/auth/logout')
    expect(
      (await member.post('/auth/login', { username: 'mom', password: 'secret123' })).status,
    ).toBe(200)
    expect((await member.get('/me')).json).toMatchObject({ kind: 'user', user: { role: 'member' } })
  })

  test('rejects duplicate usernames without creating a session or broadcasting', async () => {
    const deps = createTestDeps()
    await seedUser(deps, 'dad', 'admin')
    updateHousehold(deps, { allowRegistration: true })
    const events: string[] = []
    const unsubscribe = deps.hub.add({ kind: 'device' }, (event) => events.push(event))
    const member = createClient(deps, {}, { ip: '192.0.2.3' })
    const result = await member.post('/auth/register', {
      username: 'DAD',
      name: '重复',
      password: 'secret123',
    })
    expect(result.status).toBe(409)
    expect(result.json).toMatchObject({ error: { code: 'CONFLICT', message: '用户名已被使用' } })
    expect(countUsers(deps)).toBe(1)
    expect((await member.get('/me')).json).toEqual({ kind: 'anonymous' })
    expect(events).toEqual([])
    unsubscribe()
  })

  test('concurrent duplicate registrations return a conflict rather than an internal error', async () => {
    const deps = createTestDeps()
    await seedUser(deps, 'dad', 'admin')
    updateHousehold(deps, { allowRegistration: true })
    const clients = [
      createClient(deps, {}, { ip: '192.0.2.4' }),
      createClient(deps, {}, { ip: '192.0.2.5' }),
    ]
    const results = await Promise.all(
      clients.map((client) =>
        client.post('/auth/register', { username: 'mom', name: '妈妈', password: 'secret123' }),
      ),
    )
    expect(results.map((result) => result.status).sort()).toEqual([201, 409])
    expect(listUsers(deps).filter((user) => user.role === 'member')).toHaveLength(1)
    const sessions = await Promise.all(clients.map((client) => client.get('/me')))
    expect(sessions.map((session) => session.json)).toEqual(
      expect.arrayContaining([{ kind: 'anonymous' }, expect.objectContaining({ kind: 'user' })]),
    )
  })

  test('validates registration input without creating accounts', async () => {
    const deps = createTestDeps()
    await seedUser(deps, 'dad', 'admin')
    updateHousehold(deps, { allowRegistration: true })
    const client = createClient(deps, {}, { ip: '192.0.2.6' })
    for (const input of [
      { username: 'bad-name', name: '妈妈', password: 'secret123' },
      { username: 'mom', name: ' ', password: 'secret123' },
      { username: 'mom', name: '妈妈', password: 'short' },
      { username: 'mom', name: '妈妈' },
    ]) {
      const result = await client.post('/auth/register', input)
      expect(result.status).toBe(400)
      expect(result.json).toMatchObject({ error: { code: 'VALIDATION' } })
    }
    expect(countUsers(deps)).toBe(1)
    expect((await client.get('/me')).json).toEqual({ kind: 'anonymous' })
  })

  test('rejects cross-origin registration', async () => {
    const deps = createTestDeps()
    await seedUser(deps, 'dad', 'admin')
    updateHousehold(deps, { allowRegistration: true })
    const { raw } = createClient(deps)
    const result = await raw.request('/api/auth/register', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
        host: 'dash.local',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ username: 'mom', name: '妈妈', password: 'secret123' }),
    })
    expect(result.status).toBe(403)
    expect(countUsers(deps)).toBe(1)
  })

  test('rate limits repeated registration attempts independently from login', async () => {
    const deps = createTestDeps()
    await seedUser(deps, 'dad', 'admin')
    updateHousehold(deps, { allowRegistration: true })
    const client = createClient(deps, {}, { ip: '192.0.2.7' })
    for (let attempt = 0; attempt < 10; attempt++) {
      expect((await client.post('/auth/register', {})).status).toBe(400)
    }
    const blocked = await client.post('/auth/register', {
      username: 'mom',
      name: '妈妈',
      password: 'secret123',
    })
    expect(blocked.status).toBe(429)
    expect(blocked.json).toMatchObject({ error: { code: 'TOO_MANY_REQUESTS' } })
    expect(countUsers(deps)).toBe(1)
    expect(
      (await client.post('/auth/login', { username: 'dad', password: 'secret123' })).status,
    ).toBe(200)
  })
  test('keeps registration closed until an administrator opens it', async () => {
    const deps = createTestDeps()
    await seedUser(deps, 'dad', 'admin')
    const admin = createClient(deps, {}, { ip: '192.0.2.10' })
    await admin.post('/auth/login', { username: 'dad', password: 'secret123' })
    const guest = createClient(deps, {}, { ip: '192.0.2.11' })
    const input = { username: 'guest', name: '访客', password: 'secret123' }

    expect((await guest.get('/auth/status')).json).toEqual({
      initialized: true,
      registrationOpen: false,
    })
    const closed = await guest.post('/auth/register', input)
    expect(closed.status).toBe(403)
    expect(countUsers(deps)).toBe(1)
    expect((await guest.get('/me')).json).toEqual({ kind: 'anonymous' })

    expect((await admin.patch('/settings', { allowRegistration: true })).status).toBe(200)
    expect((await guest.get('/auth/status')).json).toMatchObject({ registrationOpen: true })
    const member = createClient(deps, {}, { ip: '192.0.2.12' })
    expect((await member.post('/auth/register', input)).status).toBe(201)
    expect((await member.patch('/settings', { allowRegistration: false })).status).toBe(403)

    expect((await admin.patch('/settings', { allowRegistration: false })).status).toBe(200)
    const another = { username: 'guest2', name: '访客2', password: 'secret123' }
    expect((await guest.post('/auth/register', another)).status).toBe(403)
    expect(countUsers(deps)).toBe(2)
  })
})

describe('rate limiting', () => {
  test('ignores forged forwarding headers from untrusted peers when rate limiting', async () => {
    const deps = createTestDeps()
    await seedUser(deps, 'dad', 'admin')
    const attacker = createClient(deps, {}, { ip: '192.0.2.20' })
    const wrong = { username: 'dad', password: 'wrong-password' }
    for (let attempt = 0; attempt < 10; attempt++) {
      const forged = createClient(
        deps,
        { 'x-forwarded-for': `198.51.100.${attempt}`, 'x-real-ip': `198.51.100.${attempt}` },
        { ip: '192.0.2.20' },
      )
      expect((await forged.post('/auth/login', wrong)).status).toBe(400)
    }
    expect((await attacker.post('/auth/login', wrong)).status).toBe(429)
    const neighbour = createClient(deps, {}, { ip: '192.0.2.21' })
    expect(
      (await neighbour.post('/auth/login', { username: 'dad', password: 'secret123' })).status,
    ).toBe(200)
  })
})
