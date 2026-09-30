import type { DeviceInfo } from '@shared/schemas/users'
import { and, desc, eq, gt, isNull, lt } from 'drizzle-orm'
import { devices, pairingCodes } from '../db/schema'
import type { Deps, DeviceRow } from '../lib/context'
import { newId, randomDigits, randomToken, sha256 } from '../lib/crypto'
import { badRequest } from '../lib/errors'

const PAIRING_TTL_MS = 5 * 60 * 1000
const LAST_SEEN_THROTTLE_MS = 60 * 1000

export type DeviceSummary = DeviceInfo & {
  lastSeenAt: number | null
  createdAt: number
}

export function createPairingCode(deps: Deps): { code: string; expiresAt: number } {
  const ts = deps.now()
  deps.db.delete(pairingCodes).where(lt(pairingCodes.expiresAt, ts)).run()
  const code = randomDigits(6)
  const expiresAt = ts + PAIRING_TTL_MS
  deps.db.insert(pairingCodes).values({ code, expiresAt, createdAt: ts, updatedAt: ts }).run()
  return { code, expiresAt }
}

export function pairDevice(
  deps: Deps,
  code: string,
  name: string,
): { token: string; device: DeviceInfo } {
  const ts = deps.now()
  const pairing = deps.db
    .select()
    .from(pairingCodes)
    .where(and(eq(pairingCodes.code, code), gt(pairingCodes.expiresAt, ts)))
    .get()
  if (!pairing) throw badRequest('配对码无效或已过期')
  deps.db.delete(pairingCodes).where(eq(pairingCodes.code, code)).run()
  const token = randomToken()
  const id = newId()
  deps.db
    .insert(devices)
    .values({ id, name, tokenHash: sha256(token), lastSeenAt: ts, createdAt: ts, updatedAt: ts })
    .run()
  return { token, device: { id, name } }
}

export function resolveDevice(deps: Deps, token: string): DeviceRow | null {
  const device = deps.db
    .select()
    .from(devices)
    .where(and(eq(devices.tokenHash, sha256(token)), isNull(devices.revokedAt)))
    .get()
  if (!device) return null
  const ts = deps.now()
  if (!device.lastSeenAt || ts - device.lastSeenAt > LAST_SEEN_THROTTLE_MS) {
    deps.db.update(devices).set({ lastSeenAt: ts }).where(eq(devices.id, device.id)).run()
  }
  return device
}

export function listDevices(deps: Deps): DeviceSummary[] {
  return deps.db
    .select()
    .from(devices)
    .where(isNull(devices.revokedAt))
    .orderBy(desc(devices.createdAt))
    .all()
    .map((d) => ({ id: d.id, name: d.name, lastSeenAt: d.lastSeenAt, createdAt: d.createdAt }))
}

export function revokeDevice(deps: Deps, id: string): void {
  const ts = deps.now()
  deps.db.update(devices).set({ revokedAt: ts, updatedAt: ts }).where(eq(devices.id, id)).run()
  deps.hub.disconnect({ deviceId: id })
}
