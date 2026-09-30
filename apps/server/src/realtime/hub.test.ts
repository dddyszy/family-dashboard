import { describe, expect, mock, test } from 'bun:test'
import { revokeDevice } from '../services/devices'
import { deleteUser, updateUser } from '../services/users'
import { createTestDeps, seedUser } from '../test-utils'
import { RealtimeHub } from './hub'

describe('RealtimeHub.disconnect', () => {
  test('closes only the matching streams and stops sending to them', () => {
    const hub = new RealtimeHub()
    const sent: string[] = []
    const closeMom = mock(() => {})
    const closeDad = mock(() => {})
    const closeKiosk = mock(() => {})
    hub.add({ kind: 'user', userId: 'mom' }, () => sent.push('mom'), { close: closeMom })
    hub.add({ kind: 'user', userId: 'dad' }, () => sent.push('dad'), { close: closeDad })
    hub.add({ kind: 'device' }, () => sent.push('kiosk'), { deviceId: 'k1', close: closeKiosk })

    hub.disconnect({ userId: 'mom' })
    hub.disconnect({ deviceId: 'k1' })
    hub.broadcast('members.changed', {}, { kind: 'family' })

    expect(closeMom).toHaveBeenCalledTimes(1)
    expect(closeKiosk).toHaveBeenCalledTimes(1)
    expect(closeDad).not.toHaveBeenCalled()
    expect(sent).toEqual(['dad'])
    expect(hub.size).toBe(1)
  })

  test('revoking credentials ends the affected streams', async () => {
    const deps = createTestDeps()
    const admin = await seedUser(deps, 'dad', 'admin')
    const mom = await seedUser(deps, 'mom')
    const kid = await seedUser(deps, 'kid')
    const closed: string[] = []
    deps.hub.add({ kind: 'user', userId: mom.id }, () => {}, { close: () => closed.push('mom') })
    deps.hub.add({ kind: 'user', userId: kid.id }, () => {}, { close: () => closed.push('kid') })
    deps.hub.add({ kind: 'device' }, () => {}, {
      deviceId: 'kiosk',
      close: () => closed.push('kiosk'),
    })

    await updateUser(deps, kid.id, { name: '孩子' })
    expect(closed).toEqual([])
    await updateUser(deps, kid.id, { password: 'another123' })
    deleteUser(deps, mom.id, admin.id)
    revokeDevice(deps, 'kiosk')
    expect(closed).toEqual(['kid', 'mom', 'kiosk'])
  })
})
