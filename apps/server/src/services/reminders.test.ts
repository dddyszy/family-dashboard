import { describe, expect, test } from 'bun:test'
import { HOUR_MS, MINUTE_MS, zonedTimeToUtc } from '@shared/time'
import { eq } from 'drizzle-orm'
import { reminders } from '../db/schema'
import { createClock, createTestDeps, seedUser } from '../test-utils'
import { createEvent, updateEvent } from './calendar'
import {
  activeReminders,
  dismissReminder,
  expireStaleReminders,
  fireDueReminders,
  snoozeReminder,
} from './reminders'
import { createTodo, setTodoDone } from './todos'

const TZ = 'Asia/Shanghai'
const at = (month: number, day: number, hour = 0, minute = 0) =>
  zonedTimeToUtc({ year: 2026, month, day, hour, minute }, TZ)

async function setup() {
  const clock = createClock(at(10, 1, 7))
  const deps = createTestDeps(clock)
  const dad = await seedUser(deps, 'dad', 'admin')
  const kid = await seedUser(deps, 'kid')
  const received: Array<{ to: string; title: string }> = []
  const listen = (to: string, viewer: Parameters<typeof deps.hub.add>[0]) =>
    deps.hub.add(viewer, (event, data) => {
      if (event === 'reminder.fired')
        received.push({ to, title: JSON.parse(data).reminder.payload.title })
    })
  listen('dad', { kind: 'user', userId: dad.id })
  listen('kid', { kind: 'user', userId: kid.id })
  listen('kiosk', { kind: 'device' })
  const pending = () =>
    deps.db.select().from(reminders).where(eq(reminders.status, 'pending')).all()
  return { deps, clock, dad, kid, received, pending }
}

const baseEvent = {
  allDay: false,
  rrule: null,
  visibility: 'family' as const,
  participantIds: [] as string[],
  remindOffsets: [] as number[],
}

describe('reminder generation', () => {
  test('one reminder per offset and participant', async () => {
    const { deps, dad, kid, pending } = await setup()
    createEvent(deps, dad, {
      ...baseEvent,
      title: '家长会',
      startAt: at(10, 2, 15),
      endAt: at(10, 2, 16),
      participantIds: [dad.id, kid.id],
      remindOffsets: [60, 0],
    })
    expect(
      pending()
        .map((r) => [r.userId === dad.id ? 'dad' : 'kid', r.fireAt])
        .sort(),
    ).toEqual(
      [
        ['dad', at(10, 2, 14)],
        ['dad', at(10, 2, 15)],
        ['kid', at(10, 2, 14)],
        ['kid', at(10, 2, 15)],
      ].sort(),
    )
  })

  test('recurring events are scheduled within the horizon and skip the past', async () => {
    const { deps, dad, pending } = await setup()
    createEvent(deps, dad, {
      ...baseEvent,
      title: '吃药',
      startAt: at(9, 20, 8),
      endAt: at(9, 20, 8),
      rrule: 'FREQ=DAILY',
      remindOffsets: [0],
    })
    const times = pending().map((r) => r.fireAt)
    expect(Math.min(...times)).toBe(at(10, 1, 8))
    expect(times).toHaveLength(60)
  })

  test('all-day events remind relative to 09:00', async () => {
    const { deps, dad, pending } = await setup()
    createEvent(deps, dad, {
      ...baseEvent,
      title: '交房租',
      startAt: at(10, 15),
      endAt: at(10, 16),
      allDay: true,
      remindOffsets: [1440],
    })
    expect(pending().map((r) => r.fireAt)).toEqual([at(10, 14, 9)])
  })

  test('editing an event after it fired does not fire the same reminder again', async () => {
    const { deps, clock, dad, received } = await setup()
    const event = createEvent(deps, dad, {
      ...baseEvent,
      title: '出门',
      startAt: at(10, 1, 7, 30),
      endAt: at(10, 1, 8),
      remindOffsets: [0, 15],
    })
    clock.set(at(10, 1, 7, 15))
    fireDueReminders(deps)
    updateEvent(deps, dad, event.id, 'all', undefined, { location: '门口' })
    clock.set(at(10, 1, 7, 30))
    fireDueReminders(deps)
    expect(received.filter((r) => r.to === 'dad').length).toBe(2)
  })
})

describe('reminder delivery', () => {
  test('fires to recipients and once to kiosks for family items', async () => {
    const { deps, clock, dad, kid, received } = await setup()
    createEvent(deps, dad, {
      ...baseEvent,
      title: '晚饭',
      startAt: at(10, 1, 18),
      endAt: at(10, 1, 19),
      participantIds: [dad.id, kid.id],
      remindOffsets: [0],
    })
    clock.set(at(10, 1, 18))
    expect(fireDueReminders(deps)).toBe(2)
    expect(received.map((r) => r.to).sort()).toEqual(['dad', 'kid', 'kiosk'])
    expect(activeReminders(deps, dad.id)).toHaveLength(1)
  })

  test('private items never reach kiosks', async () => {
    const { deps, clock, dad, received } = await setup()
    createEvent(deps, dad, {
      ...baseEvent,
      title: '私事',
      startAt: at(10, 1, 9),
      endAt: at(10, 1, 10),
      visibility: 'private',
      remindOffsets: [0],
    })
    clock.set(at(10, 1, 9))
    fireDueReminders(deps)
    expect(received.map((r) => r.to)).toEqual(['dad'])
  })

  test('dismiss and snooze', async () => {
    const { deps, clock, dad } = await setup()
    createEvent(deps, dad, {
      ...baseEvent,
      title: 'A',
      startAt: at(10, 1, 9),
      endAt: at(10, 1, 10),
      remindOffsets: [0, 30],
    })
    clock.set(at(10, 1, 9))
    fireDueReminders(deps)
    const [first, second] = activeReminders(deps, dad.id)
    if (!first || !second) throw new Error('expected two active reminders')
    dismissReminder(deps, dad, first.id)
    const snoozed = snoozeReminder(deps, dad, second.id, 10)
    expect(snoozed.fireAt).toBe(at(10, 1, 9, 10))
    expect(activeReminders(deps, dad.id)).toHaveLength(0)
    clock.advance(10 * MINUTE_MS)
    expect(fireDueReminders(deps)).toBe(1)
  })

  test('reminders missed for more than a day expire instead of firing', async () => {
    const { deps, clock, dad } = await setup()
    createEvent(deps, dad, {
      ...baseEvent,
      title: '旧事',
      startAt: at(10, 1, 9),
      endAt: at(10, 1, 10),
      remindOffsets: [0],
    })
    clock.set(at(10, 2, 10))
    expireStaleReminders(deps)
    expect(fireDueReminders(deps)).toBe(0)
  })
})

describe('todos', () => {
  test('completing a recurring todo moves it to the next due date and reschedules', async () => {
    const { deps, clock, dad, pending } = await setup()
    const todo = createTodo(deps, dad, {
      title: '交电费',
      dueAt: at(10, 2, 20),
      rrule: 'FREQ=WEEKLY;BYDAY=FR',
      visibility: 'family',
      assigneeIds: [],
      remindOffsets: [60],
    })
    expect(pending().map((r) => r.fireAt)).toEqual([at(10, 2, 19)])
    clock.set(at(10, 3, 9))
    const done = setTodoDone(deps, dad, todo.id, true)
    expect(done.doneAt).toBeNull()
    expect(done.dueAt).toBe(at(10, 9, 20))
    expect(pending().map((r) => r.fireAt)).toEqual([at(10, 9, 20) - HOUR_MS])
  })

  test('completing a one-off todo closes it and clears reminders', async () => {
    const { deps, dad, pending } = await setup()
    const todo = createTodo(deps, dad, {
      title: '取快递',
      dueAt: at(10, 1, 18),
      visibility: 'family',
      assigneeIds: [],
      remindOffsets: [0],
    })
    const done = setTodoDone(deps, dad, todo.id, true)
    expect(done.doneAt).not.toBeNull()
    expect(pending()).toHaveLength(0)
  })
})
