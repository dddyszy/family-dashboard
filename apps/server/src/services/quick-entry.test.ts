import { describe, expect, test } from 'bun:test'
import { zonedTimeToUtc } from '@shared/time'
import { parseNumber, parseQuickEntry } from './quick-entry'

const TZ = 'Asia/Shanghai'
const at = (month: number, day: number, hour = 0, minute = 0) =>
  zonedTimeToUtc({ year: 2026, month, day, hour, minute }, TZ)
// Thursday, 1 Oct 2026, 10:00
const NOW = at(10, 1, 10)
const MEMBERS = [
  { id: 'u-kid', name: '小明' },
  { id: 'u-mom', name: '妈妈' },
]
const parse = (text: string) => parseQuickEntry(text, NOW, TZ, MEMBERS)

describe('parseNumber', () => {
  test('handles digits and Chinese numerals', () => {
    expect(parseNumber('3')).toBe(3)
    expect(parseNumber('三')).toBe(3)
    expect(parseNumber('十')).toBe(10)
    expect(parseNumber('十二')).toBe(12)
    expect(parseNumber('二十三')).toBe(23)
    expect(parseNumber('两')).toBe(2)
  })
})

describe('parseQuickEntry', () => {
  test('relative day, afternoon time and reminder', () => {
    expect(parse('明天下午3点 家长会 提前1小时')).toEqual({
      title: '家长会',
      startAt: at(10, 2, 15),
      endAt: at(10, 2, 16),
      allDay: false,
      rrule: null,
      remindOffsets: [60],
      participantIds: [],
    })
  })

  test('weekly recurrence with participant', () => {
    const draft = parse('每周六上午10点 游泳课 @小明')
    expect(draft).toMatchObject({
      title: '游泳课',
      startAt: at(10, 3, 10),
      rrule: 'FREQ=WEEKLY;BYDAY=SA',
      participantIds: ['u-kid'],
      allDay: false,
    })
  })

  test('explicit date, all day', () => {
    expect(parse('10月5日 全天 回老家')).toMatchObject({
      title: '回老家',
      startAt: at(10, 5),
      endAt: at(10, 6),
      allDay: true,
    })
  })

  test('weekday with evening half hour', () => {
    expect(parse('周五晚上8点半 看电影')).toMatchObject({
      title: '看电影',
      startAt: at(10, 2, 20, 30),
    })
  })

  test('daily reminder at a time that already passed today starts tomorrow', () => {
    expect(parse('每天早上7点 吃药 提醒我')).toMatchObject({
      title: '吃药',
      rrule: 'FREQ=DAILY',
      startAt: at(10, 2, 7),
      remindOffsets: [0],
    })
  })

  test('day of month without time is all day with a one-day-ahead reminder', () => {
    expect(parse('15号 交房租 提前1天')).toMatchObject({
      title: '交房租',
      startAt: at(10, 15),
      allDay: true,
      remindOffsets: [1440],
    })
  })

  test('next-week weekday and explicit duration', () => {
    expect(parse('下周一 14:30 牙医 2小时')).toMatchObject({
      title: '牙医',
      startAt: at(10, 5, 14, 30),
      endAt: at(10, 5, 16, 30),
    })
  })

  test('past month-day rolls over to next year', () => {
    expect(parse('3月1日 体检').startAt).toBe(zonedTimeToUtc({ year: 2027, month: 3, day: 1 }, TZ))
  })

  test('falls back to a default title', () => {
    expect(parse('明天9点').title).toBe('新日程')
  })
})
