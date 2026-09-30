import { describe, expect, test } from 'bun:test'
import { buildPresetRrule, RECURRENCE_PRESETS, rruleProblem } from './recurrence'
import { rruleSchema } from './schemas/common'

describe('rruleProblem', () => {
  test('accepts every preset and common custom rules', () => {
    const startAt = Date.UTC(2026, 0, 31, 1)
    for (const preset of RECURRENCE_PRESETS) {
      const rule = buildPresetRrule(preset, startAt, 'Asia/Shanghai')
      if (rule) expect(rruleProblem(rule)).toBeNull()
    }
    for (const rule of [
      'FREQ=DAILY;COUNT=10',
      'FREQ=DAILY;UNTIL=20261004T075959Z',
      'FREQ=DAILY;INTERVAL=3',
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;WKST=MO',
      'FREQ=MONTHLY;BYDAY=-1FR',
      'FREQ=MONTHLY;BYMONTHDAY=-1',
      'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29',
      'FREQ=YEARLY;BYMONTH=5;BYDAY=2SU',
    ]) {
      expect(rruleProblem(rule)).toBeNull()
    }
  })

  test('rejects rules that make the rrule library hang, throw or explode', () => {
    for (const rule of [
      'FREQ=DAILY;INTERVAL=-1',
      'FREQ=DAILY;INTERVAL=0',
      'FREQ=DAILY;INTERVAL=100',
      'FREQ=WEEKLY;BYDAY=XX',
      'FREQ=WEEKLY;BYDAY=1MO',
      'FREQ=DAILY;BYSETPOS=5',
      'FREQ=DAILY;BYHOUR=1,2,3',
      'FREQ=DAILY;BYMINUTE=0,30',
      'FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30',
      'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30,31',
      'FREQ=YEARLY;BYMONTH=4,6;BYMONTHDAY=-31',
      'FREQ=DAILY;INTERVAL=7;BYDAY=TU',
      'FREQ=MONTHLY;BYMONTHDAY=0',
      'FREQ=MONTHLY;BYMONTHDAY=32',
      'FREQ=YEARLY;BYMONTH=13',
      'FREQ=DAILY;COUNT=0',
      'FREQ=DAILY;COUNT=1001',
      'FREQ=DAILY;COUNT=5;UNTIL=20261004T075959Z',
      'FREQ=DAILY;UNTIL=tomorrow',
      'FREQ=DAILY;COUNT=5;COUNT=6',
      'FREQ=HOURLY',
    ]) {
      expect({ rule, problem: rruleProblem(rule) }).toEqual({ rule, problem: expect.any(String) })
    }
  })

  test('rruleSchema reports the problem as a validation error', () => {
    const result = rruleSchema.safeParse('FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30')
    expect(result.success).toBe(false)
    expect(rruleSchema.safeParse('FREQ=WEEKLY;BYDAY=MO').success).toBe(true)
  })
})
