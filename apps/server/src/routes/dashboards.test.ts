import { describe, expect, test } from 'bun:test'
import type { Dashboard } from '@shared/schemas/dashboard'
import { createClient, createTestDeps } from '../test-utils'

describe('shared dashboard', () => {
  test('every member and kiosk sees the same board, members can edit it, kiosks cannot', async () => {
    const deps = createTestDeps()
    const admin = createClient(deps)
    await admin.post('/auth/setup', { username: 'dad', name: '爸爸', password: 'secret123' })
    await admin.post('/users', { username: 'mom', name: '妈妈', password: 'secret456' })
    const mom = createClient(deps)
    await mom.post('/auth/login', { username: 'mom', password: 'secret456' })
    const { json: pairing } = await admin.post('/devices/pairing-code')
    const kiosk = createClient(deps)
    await kiosk.post('/devices/pair', { code: (pairing as { code: string }).code, name: '客厅' })

    const board = (await admin.get('/dashboard')).json as Dashboard
    expect(board.widgets.length).toBeGreaterThan(0)
    expect(((await mom.get('/dashboard')).json as Dashboard).id).toBe(board.id)

    const [first] = board.widgets
    if (!first) throw new Error('expected default widgets')
    const trimmed = {
      widgets: [first],
      layouts: {
        lg: board.layouts.lg.filter((i) => i.i === first.id),
        md: board.layouts.md.filter((i) => i.i === first.id),
        sm: board.layouts.sm.filter((i) => i.i === first.id),
      },
    }
    expect((await mom.put('/dashboard', trimmed)).status).toBe(200)
    expect(((await kiosk.get('/dashboard')).json as Dashboard).widgets).toHaveLength(1)
    expect((await kiosk.put('/dashboard', trimmed)).status).toBe(403)
  })

  test('saving ignores layout entries of widgets that were just removed', async () => {
    const deps = createTestDeps()
    const admin = createClient(deps)
    await admin.post('/auth/setup', { username: 'dad', name: '爸爸', password: 'secret123' })
    const board = (await admin.get('/dashboard')).json as Dashboard
    const [first] = board.widgets
    if (!first) throw new Error('expected default widgets')
    const res = await admin.put('/dashboard', { widgets: [first], layouts: board.layouts })
    expect(res.status).toBe(200)
    const saved = res.json as Dashboard
    expect(saved.layouts.lg.map((i) => i.i)).toEqual([first.id])
    expect(saved.layouts.sm.map((i) => i.i)).toEqual([first.id])
  })
})
