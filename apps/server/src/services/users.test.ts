import { describe, expect, spyOn, test } from 'bun:test'
import { createClient, createTestDeps, seedUser } from '../test-utils'
import { login } from './auth'
import { getUser, updateUser } from './users'

describe('credential changes', () => {
  test('changing your password revokes other sessions and preserves the current browser', async () => {
    const deps = createTestDeps()
    const user = await seedUser(deps, 'owner')
    const current = createClient(deps, {}, { ip: '192.0.2.101' })
    const other = createClient(deps, {}, { ip: '192.0.2.102' })
    const login = { username: user.username, password: 'secret123' }
    expect((await current.post('/auth/login', login)).status).toBe(200)
    expect((await other.post('/auth/login', login)).status).toBe(200)
    const disconnected: string[] = []
    deps.hub.add({ kind: 'user', userId: user.id }, () => {}, {
      close: () => disconnected.push(user.id),
    })
    expect(
      (await current.patch('/me', { currentPassword: 'secret123', newPassword: 'new-secret123' }))
        .status,
    ).toBe(200)
    expect((await current.get('/me')).json).toMatchObject({ kind: 'user' })
    expect((await other.get('/me')).json).toEqual({ kind: 'anonymous' })
    expect(disconnected).toEqual([user.id])
    expect((await other.post('/auth/login', login)).status).toBe(400)
    expect((await other.post('/auth/login', { ...login, password: 'new-secret123' })).status).toBe(
      200,
    )
  })

  test('concurrent role and password changes cannot demote every administrator', async () => {
    const deps = createTestDeps()
    const first = await seedUser(deps, 'first', 'admin')
    const second = await seedUser(deps, 'second', 'admin')
    const results = await Promise.allSettled([
      updateUser(deps, first.id, { role: 'member', password: 'new-secret123' }),
      updateUser(deps, second.id, { role: 'member', password: 'new-secret123' }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(
      [getUser(deps, first.id), getUser(deps, second.id)].filter((u) => u.role === 'admin'),
    ).toHaveLength(1)
  })
})

test('a login being verified cannot survive a concurrent password reset', async () => {
  const deps = createTestDeps()
  const user = await seedUser(deps, 'reset-race')
  const gate = Promise.withResolvers<boolean>()
  const verify = spyOn(Bun.password, 'verify').mockImplementationOnce(() => gate.promise)
  try {
    const pending = login(deps, { username: user.username, password: 'secret123' }, null)
    await updateUser(deps, user.id, { password: 'replacement-password' })
    gate.resolve(true)
    await expect(pending).rejects.toThrow('用户名或密码不正确')
  } finally {
    gate.resolve(false)
    verify.mockRestore()
  }
})
