import { parseRruleParts, stringifyRruleParts } from '@shared/recurrence'
import { fromWallClockDate, toWallClockDate } from '@shared/time'
import { RRule } from 'rrule'

export type Recurring = {
  startAt: number
  endAt: number
  rrule: string | null
  exdates: readonly number[]
}

export type Occurrence = { occurrenceAt: number; startAt: number; endAt: number }

/** Upper bound per expansion; accepted rules yield at most one occurrence a day. */
const MAX_OCCURRENCES = 2000

function overlaps(startAt: number, endAt: number, from: number, to: number): boolean {
  if (startAt >= to) return false
  if (endAt === startAt) return startAt >= from
  return endAt > from
}

/**
 * Rules are evaluated on wall-clock time in the household time zone (encoded as fake-UTC Dates),
 * so "every day at 08:00" stays at 08:00 across DST changes.
 */
function buildRule(rrule: string, startAt: number, timeZone: string): RRule {
  const options = RRule.parseString(rrule)
  return new RRule({ ...options, dtstart: toWallClockDate(startAt, timeZone) })
}

/** Occurrences overlapping [from, to), with excluded dates removed. */
export function expandOccurrences(
  event: Recurring,
  from: number,
  to: number,
  timeZone: string,
): Occurrence[] {
  const duration = event.endAt - event.startAt
  if (!event.rrule) {
    return overlaps(event.startAt, event.endAt, from, to)
      ? [{ occurrenceAt: event.startAt, startAt: event.startAt, endAt: event.endAt }]
      : []
  }
  if (event.startAt >= to) return []
  const rule = buildRule(event.rrule, event.startAt, timeZone)
  const windowStart = toWallClockDate(Math.max(event.startAt, from - duration), timeZone)
  const windowEnd = toWallClockDate(to, timeZone)
  const excluded = new Set(event.exdates)
  const result: Occurrence[] = []
  for (const date of rule.between(windowStart, windowEnd, true, (_, i) => i < MAX_OCCURRENCES)) {
    const occurrenceAt = fromWallClockDate(date, timeZone)
    if (excluded.has(occurrenceAt)) continue
    const endAt = occurrenceAt + duration
    if (overlaps(occurrenceAt, endAt, from, to))
      result.push({ occurrenceAt, startAt: occurrenceAt, endAt })
  }
  return result
}

/** First occurrence strictly after `after`, or null when the series has ended. */
export function nextOccurrence(
  rrule: string,
  startAt: number,
  after: number,
  timeZone: string,
): number | null {
  const rule = buildRule(rrule, startAt, timeZone)
  const next = rule.after(toWallClockDate(after, timeZone), false)
  return next ? fromWallClockDate(next, timeZone) : null
}

function formatUntil(ms: number, timeZone: string): string {
  const d = toWallClockDate(ms, timeZone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes(),
  )}${pad(d.getUTCSeconds())}Z`
}

/** Ends a series just before `occurrenceAt` (used by "this and following" edits). */
export function truncateRrule(rrule: string, occurrenceAt: number, timeZone: string): string {
  const parts = parseRruleParts(rrule)
  parts.delete('COUNT')
  parts.set('UNTIL', formatUntil(occurrenceAt - 1000, timeZone))
  return stringifyRruleParts(parts)
}

/** Whether a rule still yields anything at or after `startAt` (a truncated series may be empty). */
export function hasOccurrences(event: Recurring, timeZone: string): boolean {
  if (!event.rrule) return true
  const rule = buildRule(event.rrule, event.startAt, timeZone)
  return rule.after(toWallClockDate(event.startAt, timeZone), true) !== null
}
