import type { EventInstance } from '@shared/schemas/calendar'
import type { PublicUser } from '@shared/schemas/users'
import { addZonedDays, getZonedParts, startOfZonedDay, zonedTimeToUtc } from '@shared/time'

export const DEFAULT_EVENT_COLOR = '#0a84ff'

export function eventColor(
  event: Pick<EventInstance, 'color' | 'participantIds' | 'ownerId'>,
  members: Map<string, PublicUser>,
): string {
  if (event.color) return event.color
  const first = event.participantIds[0] ?? event.ownerId
  return members.get(first)?.color ?? DEFAULT_EVENT_COLOR
}

/** Members an event belongs to: its participants, or its owner when nobody was invited. */
export function eventMembers(event: Pick<EventInstance, 'participantIds' | 'ownerId'>): string[] {
  return event.participantIds.length > 0 ? event.participantIds : [event.ownerId]
}

export function filterByMembers(instances: EventInstance[], memberIds: string[]): EventInstance[] {
  if (memberIds.length === 0) return instances
  return instances.filter((e) => eventMembers(e).some((id) => memberIds.includes(id)))
}

/** Monday-based start of the week containing `ms`. */
export function startOfWeek(ms: number, timeZone: string): number {
  const day = startOfZonedDay(ms, timeZone)
  const weekday = getZonedParts(day, timeZone).weekday
  return addZonedDays(day, -((weekday + 6) % 7), timeZone)
}

export function startOfMonth(ms: number, timeZone: string): number {
  const p = getZonedParts(ms, timeZone)
  return zonedTimeToUtc({ year: p.year, month: p.month, day: 1 }, timeZone)
}

export function addMonths(ms: number, n: number, timeZone: string): number {
  const p = getZonedParts(ms, timeZone)
  return zonedTimeToUtc({ year: p.year, month: p.month + n, day: 1 }, timeZone)
}

export function eventsOnDay(
  instances: EventInstance[],
  dayStart: number,
  timeZone: string,
): EventInstance[] {
  const dayEnd = addZonedDays(dayStart, 1, timeZone)
  return instances.filter((e) =>
    e.endAt === e.startAt
      ? e.startAt >= dayStart && e.startAt < dayEnd
      : e.startAt < dayEnd && e.endAt > dayStart,
  )
}

export function fromInputs(date: string, time: string, timeZone: string): number {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number)
  const [hour = 0, minute = 0] = time.split(':').map(Number)
  return zonedTimeToUtc({ year, month, day, hour, minute }, timeZone)
}

export type PositionedEvent = { event: EventInstance; column: number; columns: number }

/** Lays out overlapping timed events side by side, like a calendar app's day column. */
export function layoutDay(events: EventInstance[]): PositionedEvent[] {
  const sorted = [...events].sort((a, b) => a.startAt - b.startAt || b.endAt - a.endAt)
  const result: PositionedEvent[] = []
  let cluster: PositionedEvent[] = []
  let clusterEnd = 0
  let columnEnds: number[] = []
  const flush = () => {
    const columns = columnEnds.length
    for (const item of cluster) item.columns = columns
    result.push(...cluster)
    cluster = []
    columnEnds = []
  }
  for (const event of sorted) {
    const end = Math.max(event.endAt, event.startAt + 15 * 60_000)
    if (cluster.length > 0 && event.startAt >= clusterEnd) flush()
    let column = columnEnds.findIndex((colEnd) => colEnd <= event.startAt)
    if (column === -1) {
      column = columnEnds.length
      columnEnds.push(end)
    } else {
      columnEnds[column] = end
    }
    cluster.push({ event, column, columns: 1 })
    clusterEnd = Math.max(clusterEnd, end)
  }
  flush()
  return result
}
