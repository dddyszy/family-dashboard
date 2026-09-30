import type { Visibility } from '@shared/constants'
import { eq, or, type SQL, sql } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { Audience } from '../realtime/hub'

export type Viewer = { kind: 'user'; userId: string } | { kind: 'device' }

type Owned = { ownerId: string; visibility: Visibility }

/**
 * A record is visible when the viewer owns it, it is shared with the family, or the viewer is
 * one of its members (event participants / todo assignees). Devices only ever see family data.
 */
export function canView(record: Owned, viewer: Viewer, memberIds: readonly string[] = []): boolean {
  if (record.visibility === 'family') return true
  if (viewer.kind === 'device') return false
  return record.ownerId === viewer.userId || memberIds.includes(viewer.userId)
}

/** Family records are editable by every member; private ones only by their owner. */
export function canEdit(record: Owned, viewer: Viewer): boolean {
  if (viewer.kind === 'device') return false
  return record.visibility === 'family' || record.ownerId === viewer.userId
}

export function audienceFor(record: Owned, memberIds: readonly string[] = []): Audience {
  if (record.visibility === 'family') return { kind: 'family' }
  return { kind: 'users', userIds: [...new Set([record.ownerId, ...memberIds])] }
}

export function visibleWhere(
  columns: { ownerId: SQLiteColumn; visibility: SQLiteColumn },
  viewer: Viewer,
  memberCondition?: (userId: string) => SQL,
): SQL {
  const family = eq(columns.visibility, 'family')
  if (viewer.kind === 'device') return family
  const conditions = [family, eq(columns.ownerId, viewer.userId)]
  if (memberCondition) conditions.push(memberCondition(viewer.userId))
  return or(...conditions) ?? sql`1 = 0`
}
