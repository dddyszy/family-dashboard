import { describe, expect, test } from 'bun:test'
import { createClient, createTestDeps } from '../test-utils'

async function setupFamily() {
  const deps = createTestDeps()
  const admin = createClient(deps)
  await admin.post('/auth/setup', { username: 'dad', name: '爸爸', password: 'secret123' })
  await admin.post('/users', { username: 'mom', name: '妈妈', password: 'secret456' })
  const mom = createClient(deps)
  await mom.post('/auth/login', { username: 'mom', password: 'secret456' })
  const { json: list } = await admin.post('/lists', { name: '超市' })
  await admin.post(`/lists/${(list as { id: string }).id}/items`, [{ text: '牛奶' }])
  await admin.post('/events', {
    title: '家长会',
    startAt: 1_800_000_000_000,
    endAt: 1_800_003_600_000,
  })
  await admin.post('/todos', { title: '交电费' })
  await admin.patch('/settings', { weather: { name: '北京', lat: 39.9, lon: 116.4 } })
  return { deps, admin, mom }
}

const reset = (mode: 'content' | 'factory', password = 'secret123', confirm = '重置') => ({
  mode,
  password,
  confirm,
})

describe('admin reset', () => {
  test('only admins can reset, and only with the right password and phrase', async () => {
    const { admin, mom } = await setupFamily()
    expect((await mom.post('/admin/reset', reset('content', 'secret456'))).status).toBe(403)
    expect((await admin.post('/admin/reset', reset('content', 'wrong-password'))).status).toBe(400)
    expect((await admin.post('/admin/reset', reset('content', 'secret123', '确定'))).status).toBe(
      400,
    )
    expect(((await admin.get('/lists')).json as unknown[]).length).toBe(1)
  })

  test('content reset clears family data but keeps accounts and settings', async () => {
    const { admin, mom } = await setupFamily()
    const res = await admin.post('/admin/reset', reset('content'))
    expect(res.status).toBe(200)
    expect((await admin.get('/lists')).json).toEqual([])
    expect((await admin.get('/todos')).json).toEqual([])
    expect((await admin.get('/events?from=1799990000000&to=1800010000000')).json).toEqual([])
    expect(((await admin.get('/users')).json as unknown[]).length).toBe(2)
    expect((await mom.get('/me')).json).toMatchObject({ kind: 'user' })
    expect((await admin.get('/settings')).json).toMatchObject({ weather: { name: '北京' } })
    expect(
      ((await admin.get('/dashboard')).json as { widgets: unknown[] }).widgets.length,
    ).toBeGreaterThan(0)
  })

  test('factory reset removes everything and returns to first-run setup', async () => {
    const { admin, mom } = await setupFamily()
    expect((await admin.post('/admin/reset', reset('factory'))).status).toBe(200)
    expect((await admin.get('/auth/status')).json).toMatchObject({ initialized: false })
    expect((await admin.get('/me')).json).toEqual({ kind: 'anonymous' })
    expect((await mom.get('/me')).json).toEqual({ kind: 'anonymous' })
    const setup = await admin.post('/auth/setup', {
      username: 'mom',
      name: '妈妈',
      password: 'secret789',
    })
    expect(setup.status).toBe(200)
    expect((await admin.get('/settings')).json).toMatchObject({ weather: { name: '上海' } })
  })
})
