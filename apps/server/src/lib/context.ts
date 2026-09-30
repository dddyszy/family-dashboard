import type { Db } from '../db/client'
import type { devices, users } from '../db/schema'
import type { RealtimeHub } from '../realtime/hub'
import type { Viewer } from './visibility'

export type UserRow = typeof users.$inferSelect
export type DeviceRow = typeof devices.$inferSelect

export type Deps = {
  db: Db
  hub: RealtimeHub
  now: () => number
}

export type Actor = { kind: 'user'; user: UserRow } | { kind: 'device'; device: DeviceRow }

export type AppEnv = {
  Variables: {
    deps: Deps
    actor: Actor | null
  }
}

export function viewerOf(actor: Actor): Viewer {
  return actor.kind === 'user' ? { kind: 'user', userId: actor.user.id } : { kind: 'device' }
}
