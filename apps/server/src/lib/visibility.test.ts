import { describe, expect, test } from 'bun:test'
import { audienceFor, canEdit, canView, type Viewer } from './visibility'

const owner: Viewer = { kind: 'user', userId: 'owner' }
const other: Viewer = { kind: 'user', userId: 'other' }
const member: Viewer = { kind: 'user', userId: 'member' }
const device: Viewer = { kind: 'device' }

const privateRecord = { ownerId: 'owner', visibility: 'private' as const }
const familyRecord = { ownerId: 'owner', visibility: 'family' as const }

describe('canView', () => {
  test('family records are visible to everyone including devices', () => {
    for (const viewer of [owner, other, device]) expect(canView(familyRecord, viewer)).toBe(true)
  })

  test('private records are visible to the owner and listed members only', () => {
    expect(canView(privateRecord, owner)).toBe(true)
    expect(canView(privateRecord, other)).toBe(false)
    expect(canView(privateRecord, member, ['member'])).toBe(true)
    expect(canView(privateRecord, device, ['member'])).toBe(false)
  })
})

describe('canEdit', () => {
  test('family records are editable by any user but never by devices', () => {
    expect(canEdit(familyRecord, other)).toBe(true)
    expect(canEdit(familyRecord, device)).toBe(false)
  })

  test('private records are editable by the owner only', () => {
    expect(canEdit(privateRecord, owner)).toBe(true)
    expect(canEdit(privateRecord, member)).toBe(false)
  })
})

describe('audienceFor', () => {
  test('family records broadcast to everyone', () => {
    expect(audienceFor(familyRecord)).toEqual({ kind: 'family' })
  })

  test('private records broadcast to owner and members, deduplicated', () => {
    expect(audienceFor(privateRecord, ['member', 'owner'])).toEqual({
      kind: 'users',
      userIds: ['owner', 'member'],
    })
  })
})
