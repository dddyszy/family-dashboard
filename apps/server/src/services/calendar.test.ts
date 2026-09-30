import { describe, expect, test } from 'bun:test'
import { zonedTimeToUtc } from '@shared/time'
import { createClock, createTestDeps, seedUser } from '../test-utils'
import { createEvent, deleteEvent, listEventsInRange, updateEvent } from './calendar'

const TZ = 'Asia/Shanghai'
const at = (month: number, day: number, hour = 0, minute = 0) =>
  zonedTimeToUtc({ year: 2026, month, day, hour, minute }, TZ)

async function setup() {
  const deps = createTestDeps(createClock(at(10, 1, 7)))
  const dad = await seedUser(deps, 'dad', 'admin')
  const kid = await seedUser(deps, 'kid')
  const series = createEvent(deps, dad, {
    title: '晨跑',
    startAt: at(10, 1, 8),
    endAt: at(10, 1, 9),
    allDay: false,
    rrule: 'FREQ=DAILY',
    visibility: 'family',
    participantIds: [],
    remindOffsets: [],
  })
  const viewer = { kind: 'user' as const, userId: dad.id }
  const week = () => listEventsInRange(deps, viewer, at(10, 1), at(10, 8))
  return { deps, dad, kid, series, viewer, week }
}

describe('recurring event edits', () => {
  test('"this" creates an override and excludes the original occurrence', async () => {
    const { deps, dad, series, week } = await setup()
    updateEvent(deps, dad, series.id, 'this', at(10, 3, 8), {
      title: '晨跑（公园）',
      startAt: at(10, 3, 7),
    })
    const list = week()
    expect(list).toHaveLength(7)
    const oct3 = list.filter((e) => e.startAt >= at(10, 3) && e.startAt < at(10, 4))
    expect(oct3.map((e) => [e.title, e.startAt])).toEqual([['晨跑（公园）', at(10, 3, 7)]])
    expect(oct3[0]?.parentId).toBe(series.id)
  })

  test('"following" splits the series and keeps earlier occurrences unchanged', async () => {
    const { deps, dad, series, week } = await setup()
    updateEvent(deps, dad, series.id, 'following', at(10, 4, 8), {
      title: '夜跑',
      startAt: at(10, 4, 20),
      endAt: at(10, 4, 21),
    })
    const list = week()
    expect(list.filter((e) => e.title === '晨跑').map((e) => e.startAt)).toEqual([
      at(10, 1, 8),
      at(10, 2, 8),
      at(10, 3, 8),
    ])
    expect(list.filter((e) => e.title === '夜跑').map((e) => e.startAt)).toEqual([
      at(10, 4, 20),
      at(10, 5, 20),
      at(10, 6, 20),
      at(10, 7, 20),
    ])
  })

  test('"following" moves later overrides onto the new series', async () => {
    const { deps, dad, series, week } = await setup()
    updateEvent(deps, dad, series.id, 'this', at(10, 5, 8), { title: '特别晨跑' })
    updateEvent(deps, dad, series.id, 'following', at(10, 4, 8), { location: '河边' })
    const list = week()
    expect(list).toHaveLength(7)
    expect(list.find((e) => e.title === '特别晨跑')?.startAt).toBe(at(10, 5, 8))
  })

  test('"all" moving the start shifts exceptions along with the series', async () => {
    const { deps, dad, series, week } = await setup()
    deleteEvent(deps, dad, series.id, 'this', at(10, 2, 8))
    updateEvent(deps, dad, series.id, 'all', undefined, {
      startAt: at(10, 1, 9),
      endAt: at(10, 1, 10),
    })
    const list = week()
    expect(list).toHaveLength(6)
    expect(list.some((e) => e.startAt === at(10, 2, 9))).toBe(false)
    expect(list[0]?.startAt).toBe(at(10, 1, 9))
  })
})

describe('recurring event deletes', () => {
  test('"this" removes one occurrence', async () => {
    const { deps, dad, series, week } = await setup()
    deleteEvent(deps, dad, series.id, 'this', at(10, 2, 8))
    expect(week()).toHaveLength(6)
  })

  test('"following" ends the series', async () => {
    const { deps, dad, series, week } = await setup()
    deleteEvent(deps, dad, series.id, 'following', at(10, 4, 8))
    expect(week().map((e) => e.startAt)).toEqual([at(10, 1, 8), at(10, 2, 8), at(10, 3, 8)])
  })

  test('"all" removes the series and its overrides', async () => {
    const { deps, dad, series, week } = await setup()
    updateEvent(deps, dad, series.id, 'this', at(10, 3, 8), { title: 'x' })
    deleteEvent(deps, dad, series.id, 'all', undefined)
    expect(week()).toHaveLength(0)
  })
})

describe('event visibility', () => {
  test('private events are visible to participants but not to others or devices', async () => {
    const { deps, dad, kid } = await setup()
    const mom = await seedUser(deps, 'mom')
    createEvent(deps, dad, {
      title: '家长会',
      startAt: at(10, 2, 15),
      endAt: at(10, 2, 16),
      allDay: false,
      rrule: null,
      visibility: 'private',
      participantIds: [kid.id],
      remindOffsets: [],
    })
    const titles = (viewer: Parameters<typeof listEventsInRange>[1]) =>
      listEventsInRange(deps, viewer, at(10, 2), at(10, 3)).map((e) => e.title)
    expect(titles({ kind: 'user', userId: kid.id })).toContain('家长会')
    expect(titles({ kind: 'user', userId: mom.id })).not.toContain('家长会')
    expect(titles({ kind: 'device' })).not.toContain('家长会')
  })
})
