import { BYDAY_CODES } from '@shared/recurrence'
import type { QuickEntryDraft } from '@shared/schemas/calendar'
import { addZonedDays, getZonedParts, MINUTE_MS, zonedTimeToUtc } from '@shared/time'

type Member = { id: string; name: string }

const DIGITS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
}

const WEEKDAY_CHARS: Record<string, number> = {
  日: 0,
  天: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
}

const NUM = '(\\d{1,2}|[零一二两三四五六七八九十]{1,3})'
const WEEKDAY = '([一二三四五六日天])'

/** Parses 1-99 written as Arabic digits or simple Chinese numerals (e.g. 十二, 二十三). */
export function parseNumber(text: string): number | null {
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text)
  if (text === '半') return 0.5
  if (text === '十') return 10
  const tens = text.indexOf('十')
  if (tens === -1) return text.length === 1 ? (DIGITS[text] ?? null) : null
  const high = tens === 0 ? 1 : (DIGITS[text.slice(0, tens)] ?? null)
  const low = tens === text.length - 1 ? 0 : (DIGITS[text.slice(tens + 1)] ?? null)
  return high === null || low === null ? null : high * 10 + low
}

type Day = { year: number; month: number; day: number }

function dayOf(ms: number, timeZone: string): Day {
  const p = getZonedParts(ms, timeZone)
  return { year: p.year, month: p.month, day: p.day }
}

function addDays(day: Day, n: number, timeZone: string): Day {
  return dayOf(addZonedDays(zonedTimeToUtc(day, timeZone), n, timeZone), timeZone)
}

function upcomingWeekday(today: Day, weekday: number, timeZone: string, weekOffset = 0): Day {
  const todayWeekday = getZonedParts(zonedTimeToUtc(today, timeZone), timeZone).weekday
  if (weekOffset > 0) {
    // "下周X": weekday X of next calendar week (weeks start on Monday).
    const mondayDelta = ((todayWeekday + 6) % 7) * -1 + 7 * weekOffset
    return addDays(today, mondayDelta + ((weekday + 6) % 7), timeZone)
  }
  return addDays(today, (weekday - todayWeekday + 7) % 7, timeZone)
}

export function parseQuickEntry(
  input: string,
  now: number,
  timeZone: string,
  members: readonly Member[],
): QuickEntryDraft {
  let text = ` ${input.trim()} `
  const take = (pattern: RegExp): RegExpExecArray | null => {
    const match = pattern.exec(text)
    if (match) text = text.replace(match[0], ' ')
    return match
  }

  const participantIds: string[] = []
  for (const match of input.matchAll(/[@＠]([^\s@＠,，]+)/g)) {
    const name = match[1] ?? ''
    const member =
      members.find((m) => m.name === name) ?? members.find((m) => m.name.startsWith(name))
    if (member) {
      if (!participantIds.includes(member.id)) participantIds.push(member.id)
      text = text.replace(match[0], ' ')
    }
  }

  const remindOffsets: number[] = []
  const remindPattern = new RegExp(
    `提前\\s*(${NUM.slice(1, -1)}|半)\\s*(个)?\\s*(分钟|分|小时|钟头|天)`,
  )
  for (let remind = take(remindPattern); remind; remind = take(remindPattern)) {
    const amount = parseNumber(remind[1] ?? '') ?? 0
    const unit = remind[3] ?? ''
    const minutes = unit.startsWith('分') ? amount : unit === '天' ? amount * 1440 : amount * 60
    remindOffsets.push(Math.round(minutes))
  }
  if (take(/(并|要)?提醒(我|一下)?/) && remindOffsets.length === 0) remindOffsets.push(0)

  let allDay = Boolean(take(/全天|整天/))
  const today = dayOf(now, timeZone)
  const nextMonthDay = (day: number): Day =>
    day >= today.day ? { ...today, day } : { ...addDays({ ...today, day: 1 }, 32, timeZone), day }
  const upcomingMonthDay = (month: number, day: number): Day => {
    const inPast = month < today.month || (month === today.month && day < today.day)
    return { year: inPast ? today.year + 1 : today.year, month, day }
  }

  const parseRecurrence = (): { rrule: string; date?: Day } | null => {
    if (take(/每天|每日/)) return { rrule: 'FREQ=DAILY' }
    if (take(/(每个?)?工作日/)) return { rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' }
    const weekly = take(new RegExp(`每个?(?:周|星期|礼拜)${WEEKDAY}`))
    if (weekly) {
      const weekday = WEEKDAY_CHARS[weekly[1] ?? ''] ?? 0
      return {
        rrule: `FREQ=WEEKLY;BYDAY=${BYDAY_CODES[weekday]}`,
        date: upcomingWeekday(today, weekday, timeZone),
      }
    }
    const monthly = take(new RegExp(`每个?月\\s*${NUM}\\s*[号日]`))
    if (monthly) {
      const day = parseNumber(monthly[1] ?? '') ?? 1
      return { rrule: `FREQ=MONTHLY;BYMONTHDAY=${day}`, date: nextMonthDay(day) }
    }
    if (take(/每年/)) return { rrule: 'FREQ=YEARLY' }
    return null
  }

  const parseDate = (): Day | null => {
    if (take(/大后天/)) return addDays(today, 3, timeZone)
    if (take(/后天/)) return addDays(today, 2, timeZone)
    if (take(/明天|明日|明早|明晚/)) return addDays(today, 1, timeZone)
    if (take(/今天|今日|今早|今晚/)) return today
    const nextWeek = take(new RegExp(`(下+)(?:周|星期|礼拜)${WEEKDAY}`))
    if (nextWeek) {
      const weekday = WEEKDAY_CHARS[nextWeek[2] ?? ''] ?? 0
      return upcomingWeekday(today, weekday, timeZone, (nextWeek[1] ?? '下').length)
    }
    const thisWeek = take(new RegExp(`(?:这|本)?(?:周|星期|礼拜)${WEEKDAY}`))
    if (thisWeek) return upcomingWeekday(today, WEEKDAY_CHARS[thisWeek[1] ?? ''] ?? 0, timeZone)
    const monthDay = take(new RegExp(`${NUM}\\s*月\\s*${NUM}\\s*[日号]?`))
    if (monthDay) {
      return upcomingMonthDay(
        parseNumber(monthDay[1] ?? '') ?? today.month,
        parseNumber(monthDay[2] ?? '') ?? 1,
      )
    }
    const slashed = take(/(\d{1,2})[/-](\d{1,2})(?![:\d])/)
    if (slashed) return upcomingMonthDay(Number(slashed[1]), Number(slashed[2]))
    const dayOnly = take(new RegExp(`${NUM}\\s*[号日](?!程)`))
    if (dayOnly) return nextMonthDay(parseNumber(dayOnly[1] ?? '') ?? today.day)
    return null
  }

  const parseClock = (): { hour: number | null; minute: number } => {
    const hm = take(/(\d{1,2})[:：](\d{2})/)
    if (hm) return { hour: Number(hm[1]), minute: Number(hm[2]) }
    const spoken = take(new RegExp(`${NUM}\\s*[点时](半|一刻|三刻|${NUM}\\s*分?)?`))
    if (!spoken) return { hour: null, minute: 0 }
    const rest = spoken[2]
    const minute =
      rest === '半'
        ? 30
        : rest === '一刻'
          ? 15
          : rest === '三刻'
            ? 45
            : rest
              ? (parseNumber(rest.replace(/\s*分$/, '')) ?? 0)
              : 0
    return { hour: parseNumber(spoken[1] ?? ''), minute }
  }

  const parseDuration = (): number => {
    const hours = take(/(\d+(?:\.\d+)?|半|一|两|二|三)\s*个?\s*(小时|钟头)/)
    if (hours) return Math.round((parseNumber(hours[1] ?? '') ?? 1) * 60)
    const minutes = take(/(\d+)\s*分钟/)
    return minutes ? Number(minutes[1]) : 60
  }

  const recurrence = parseRecurrence()
  const rrule = recurrence?.rrule ?? null
  const date = recurrence?.date ?? parseDate()

  const periodMatch = take(
    /凌晨|早上|早晨|清晨|上午|中午|午饭|下午|傍晚|晚上|夜里|今晚|明晚|明早|今早/,
  )
  const period =
    periodMatch?.[0] ?? (/今晚|明晚/.test(input) ? '晚上' : /今早|明早/.test(input) ? '早上' : null)
  const clock = parseClock()
  let hour = clock.hour
  const minute = clock.minute
  if (hour !== null && period) {
    if (/下午|傍晚|晚上|夜里|今晚|明晚/.test(period) && hour < 12) hour += 12
    if (/中午|午饭/.test(period) && hour < 11) hour += 12
  }
  if (hour === null && period && !allDay) {
    hour = /凌晨/.test(period)
      ? 6
      : /早|清晨/.test(period)
        ? 8
        : /上午/.test(period)
          ? 9
          : /中午|午饭/.test(period)
            ? 12
            : /下午/.test(period)
              ? 15
              : 19
  }

  const durationMin = parseDuration()

  if (hour === null) allDay = true
  const baseDay = date ?? today
  let startAt: number
  let endAt: number
  if (allDay) {
    startAt = zonedTimeToUtc(baseDay, timeZone)
    endAt = addZonedDays(startAt, 1, timeZone)
  } else {
    startAt = zonedTimeToUtc({ ...baseDay, hour: hour ?? 9, minute }, timeZone)
    // A bare time that already passed today means the next day (e.g. typing "7点 跑步" at 10am).
    if (!date && startAt <= now) startAt = addZonedDays(startAt, 1, timeZone)
    endAt = startAt + durationMin * MINUTE_MS
  }

  const title =
    text
      .replace(/[，,。;；、]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^(在|要|去)\s*/, '') || '新日程'

  return {
    title,
    startAt,
    endAt: Math.max(endAt, startAt),
    allDay,
    rrule,
    remindOffsets: [...new Set(remindOffsets)].sort((a, b) => a - b),
    participantIds,
  }
}
