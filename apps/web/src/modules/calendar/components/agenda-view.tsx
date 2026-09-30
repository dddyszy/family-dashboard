import type { EventInstance } from '@shared/schemas/calendar'
import { addZonedDays, startOfZonedDay } from '@shared/time'
import { CalendarX } from 'lucide-react'
import { EmptyState } from '@/components/misc'
import { formatMonthDay, relativeDayLabel } from '@/lib/time'
import { eventsOnDay } from '../lib'
import { EventRow } from './event-chip'

export function AgendaView({
  from,
  days,
  instances,
  now,
  timeZone,
  onOpenEvent,
}: {
  from: number
  days: number
  instances: EventInstance[]
  now: number
  timeZone: string
  onOpenEvent: (event: EventInstance) => void
}) {
  const start = startOfZonedDay(from, timeZone)
  const groups = Array.from({ length: days }, (_, i) => addZonedDays(start, i, timeZone))
    .map((day) => ({ day, events: eventsOnDay(instances, day, timeZone) }))
    .filter((g) => g.events.length > 0)

  if (groups.length === 0) return <EmptyState icon={CalendarX} title="这段时间没有日程" />

  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ day, events }) => (
        <section key={day}>
          <h3 className="sticky top-0 mb-1 flex items-baseline gap-2 px-2 text-sm font-semibold">
            {relativeDayLabel(day, now, timeZone)}
            <span className="text-xs font-normal text-fg-muted">
              {formatMonthDay(day, timeZone)}
            </span>
          </h3>
          <div className="flex flex-col">
            {events.map((e) => (
              <EventRow key={e.key} event={e} onClick={() => onOpenEvent(e)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
