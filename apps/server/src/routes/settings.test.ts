import { describe, expect, test } from 'bun:test'
import { DEFAULT_HOUSEHOLD_SETTINGS } from '@shared/schemas/settings'
import { getHousehold } from '../services/settings'
import { createClient, createTestDeps, seedUser } from '../test-utils'

async function signedInAdmin(ip: string) {
  const deps = createTestDeps()
  await seedUser(deps, 'dad', 'admin')
  const admin = createClient(deps, {}, { ip })
  await admin.post('/auth/login', { username: 'dad', password: 'secret123' })
  return { deps, admin }
}

describe('PATCH /settings', () => {
  test('keeps every field the request omits', async () => {
    const { deps, admin } = await signedInAdmin('192.0.2.30')
    await admin.patch('/settings', {
      timezone: 'Asia/Tokyo',
      weather: { name: '东京', lat: 35.68, lon: 139.69 },
      darkWindow: { start: '21:00', end: '06:00' },
    })

    const result = await admin.patch('/settings', { kiosk: { theme: 'liquid-glass-light' } })
    expect(result.status).toBe(200)
    expect(result.json).toEqual({
      ...DEFAULT_HOUSEHOLD_SETTINGS,
      timezone: 'Asia/Tokyo',
      weather: { name: '东京', lat: 35.68, lon: 139.69 },
      darkWindow: { start: '21:00', end: '06:00' },
      kiosk: { ...DEFAULT_HOUSEHOLD_SETTINGS.kiosk, theme: 'liquid-glass-light' },
    })

    await admin.patch('/settings', { timezone: 'Asia/Shanghai' })
    expect(getHousehold(deps).kiosk.theme).toBe('liquid-glass-light')
    expect(getHousehold(deps).weather.name).toBe('东京')
  })

  test('rejects invalid values without changing anything', async () => {
    const { deps, admin } = await signedInAdmin('192.0.2.31')
    expect((await admin.patch('/settings', { darkWindow: { start: '25:00' } })).status).toBe(400)
    expect((await admin.patch('/settings', { timezone: 'Mars/Base' })).status).toBe(400)
    expect(getHousehold(deps)).toEqual(DEFAULT_HOUSEHOLD_SETTINGS)
  })
})
