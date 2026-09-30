export type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: number
}

export const MINUTE_MS = 60_000
export const HOUR_MS = 60 * MINUTE_MS
export const DAY_MS = 24 * HOUR_MS

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
    })
    formatterCache.set(timeZone, formatter)
  }
  return formatter
}

export function getZonedParts(ms: number, timeZone: string): ZonedParts {
  const result: ZonedParts = {
    year: 0,
    month: 0,
    day: 0,
    hour: 0,
    minute: 0,
    second: 0,
    weekday: 0,
  }
  for (const part of partsFormatter(timeZone).formatToParts(new Date(ms))) {
    switch (part.type) {
      case 'year':
        result.year = Number(part.value)
        break
      case 'month':
        result.month = Number(part.value)
        break
      case 'day':
        result.day = Number(part.value)
        break
      case 'hour':
        result.hour = Number(part.value)
        break
      case 'minute':
        result.minute = Number(part.value)
        break
      case 'second':
        result.second = Number(part.value)
        break
      case 'weekday':
        result.weekday = WEEKDAY_INDEX[part.value] ?? 0
        break
    }
  }
  return result
}

/** Offset in ms such that `utc + offset` is the wall-clock time in `timeZone`, read as UTC. */
export function getTimeZoneOffset(ms: number, timeZone: string): number {
  const p = getZonedParts(ms, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(ms / 1000) * 1000
}

export type WallTime = {
  year: number
  month: number
  day: number
  hour?: number
  minute?: number
  second?: number
}

export function zonedTimeToUtc(wall: WallTime, timeZone: string): number {
  const guess = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour ?? 0,
    wall.minute ?? 0,
    wall.second ?? 0,
  )
  const first = guess - getTimeZoneOffset(guess, timeZone)
  // A second pass settles instants that straddle a DST transition.
  return guess - getTimeZoneOffset(first, timeZone)
}

/** A Date whose UTC fields equal the wall-clock fields in `timeZone`. Used for RRULE expansion. */
export function toWallClockDate(ms: number, timeZone: string): Date {
  return new Date(ms + getTimeZoneOffset(ms, timeZone))
}

export function fromWallClockDate(date: Date, timeZone: string): number {
  return zonedTimeToUtc(
    {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
    },
    timeZone,
  )
}

export function startOfZonedDay(ms: number, timeZone: string): number {
  const p = getZonedParts(ms, timeZone)
  return zonedTimeToUtc({ year: p.year, month: p.month, day: p.day }, timeZone)
}

export function addZonedDays(ms: number, days: number, timeZone: string): number {
  const p = getZonedParts(ms, timeZone)
  return zonedTimeToUtc(
    {
      year: p.year,
      month: p.month,
      day: p.day + days,
      hour: p.hour,
      minute: p.minute,
      second: p.second,
    },
    timeZone,
  )
}

export function dateKey(ms: number, timeZone: string): string {
  const p = getZonedParts(ms, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

export function parseDateKey(key: string, timeZone: string): number {
  const [year = 1970, month = 1, day = 1] = key.split('-').map(Number)
  return zonedTimeToUtc({ year, month, day }, timeZone)
}

export function parseHm(value: string): { hour: number; minute: number } {
  const [hour = 0, minute = 0] = value.split(':').map(Number)
  return { hour, minute }
}

/** Whether wall-clock minute-of-day `now` falls in [start, end), wrapping past midnight. */
export function isWithinDailyWindow(nowMinutes: number, start: string, end: string): boolean {
  const s = parseHm(start)
  const e = parseHm(end)
  const startMin = s.hour * 60 + s.minute
  const endMin = e.hour * 60 + e.minute
  if (startMin === endMin) return false
  if (startMin < endMin) return nowMinutes >= startMin && nowMinutes < endMin
  return nowMinutes >= startMin || nowMinutes < endMin
}
