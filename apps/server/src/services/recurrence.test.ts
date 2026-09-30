import { describe, expect, test } from 'bun:test'
import { DAY_MS, getZonedParts, HOUR_MS, zonedTimeToUtc } from '@shared/time'
import { expandOccurrences, hasOccurrences, nextOccurrence, truncateRrule } from './recurrence'

const TZ = 'Asia/Shanghai'
const at = (month: number, day: number, hour = 0, minute = 0) =>
  zonedTimeToUtc({ year: 2026, month, day, hour, minute }, TZ)

describe('expandOccurrences', () => {
  test('single event overlapping the window', () => {
    const event = { startAt: at(10, 2, 9), endAt: at(10, 2, 10), rrule: null, exdates: [] }
    expect(expandOccurrences(event, at(10, 2), at(10, 3), TZ)).toHaveLength(1)
    expect(expandOccurrences(event, at(10, 3), at(10, 4), TZ)).toHaveLength(0)
  })

  test('daily series at a fixed local time, skipping exdates', () => {
    const event = {
      startAt: at(10, 1, 8),
      endAt: at(10, 1, 8, 30),
      rrule: 'FREQ=DAILY',
      exdates: [at(10, 3, 8)],
    }
    const result = expandOccurrences(event, at(10, 1), at(10, 5), TZ)
    expect(result.map((o) => o.startAt)).toEqual([at(10, 1, 8), at(10, 2, 8), at(10, 4, 8)])
    expect(result[0]?.endAt).toBe(at(10, 1, 8, 30))
  })

  test('weekly by weekday', () => {
    const event = {
      startAt: at(10, 3, 10),
      endAt: at(10, 3, 11),
      rrule: 'FREQ=WEEKLY;BYDAY=SA',
      exdates: [],
    }
    const result = expandOccurrences(event, at(10, 1), at(10, 31), TZ)
    expect(result.map((o) => o.startAt)).toEqual([
      at(10, 3, 10),
      at(10, 10, 10),
      at(10, 17, 10),
      at(10, 24, 10),
    ])
  })

  test('includes an occurrence that started before the window but is still running', () => {
    const event = { startAt: at(10, 1, 22), endAt: at(10, 2, 2), rrule: 'FREQ=DAILY', exdates: [] }
    const result = expandOccurrences(event, at(10, 5), at(10, 6), TZ)
    expect(result.map((o) => o.startAt)).toEqual([at(10, 4, 22), at(10, 5, 22)])
  })

  test('all-day events span whole days', () => {
    const event = {
      startAt: at(10, 1),
      endAt: at(10, 2),
      rrule: 'FREQ=WEEKLY;BYDAY=TH',
      exdates: [],
    }
    const result = expandOccurrences(event, at(10, 1), at(10, 16), TZ)
    expect(result.map((o) => o.endAt - o.startAt)).toEqual([DAY_MS, DAY_MS, DAY_MS])
  })

  test('keeps local wall-clock time across a DST change', () => {
    const ny = 'America/New_York'
    const start = zonedTimeToUtc({ year: 2026, month: 10, day: 30, hour: 8 }, ny)
    const event = { startAt: start, endAt: start + HOUR_MS, rrule: 'FREQ=DAILY', exdates: [] }
    const result = expandOccurrences(event, start, start + 4 * DAY_MS, ny)
    expect(result.map((o) => getZonedParts(o.startAt, ny).hour)).toEqual([8, 8, 8, 8])
    // The UTC offsets differ, proving the series crossed the DST boundary.
    expect(new Set(result.map((o) => (o.startAt - start) % DAY_MS)).size).toBe(2)
  })
})

describe('series helpers', () => {
  test('truncateRrule stops the series before the given occurrence', () => {
    const rrule = truncateRrule('FREQ=DAILY;COUNT=10', at(10, 4, 8), TZ)
    expect(rrule).toBe('FREQ=DAILY;UNTIL=20261004T075959Z')
    const event = { startAt: at(10, 1, 8), endAt: at(10, 1, 9), rrule, exdates: [] }
    expect(expandOccurrences(event, at(10, 1), at(10, 10), TZ)).toHaveLength(3)
  })

  test('hasOccurrences detects a series truncated to nothing', () => {
    const rrule = truncateRrule('FREQ=DAILY', at(10, 1, 8), TZ)
    expect(
      hasOccurrences({ startAt: at(10, 1, 8), endAt: at(10, 1, 9), rrule, exdates: [] }, TZ),
    ).toBe(false)
  })

  test('nextOccurrence finds the following date', () => {
    expect(nextOccurrence('FREQ=WEEKLY;BYDAY=FR', at(10, 2, 9), at(10, 3), TZ)).toBe(at(10, 9, 9))
  })
})
