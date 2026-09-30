import type { EventInstance } from '@shared/schemas/calendar'
import { addZonedDays, dateKey, getZonedParts } from '@shared/time'
import { cn } from '@/lib/cn'
import { lunarDay } from '@/lib/lunar'
import { eventsOnDay } from '../lib'
import { EventChip } from './event-chip'

const WEEK_HEADERS = ['一', '二', '三', '四', '五', '六', '日']

export function MonthView({
  gridStart,
  monthStart,
  instances,
  now,
  timeZone,
  onSelectDay,
  onOpenEvent,
}: {
  gridStart: number
  monthStart: number
  instances: EventInstance[]
  now: number
  timeZone: string
  onSelectDay: (dayStart: number) => void
  onOpenEvent: (event: EventInstance) => void
}) {
  const month = getZonedParts(monthStart, timeZone).month
  const todayKey = dateKey(now, timeZone)
  const days = Array.from({ length: 42 }, (_, i) => addZonedDays(gridStart, i, timeZone))

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-7 border-b border-line pb-2 text-center text-xs font-semibold text-fg-muted">
        {WEEK_HEADERS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((day) => {
          const p = getZonedParts(day, timeZone)
          const dayEvents = eventsOnDay(instances, day, timeZone)
          const isToday = dateKey(day, timeZone) === todayKey
          const inMonth = p.month === month
          return (
            <div
              key={day}
              onClick={() => onSelectDay(day)}
              className={cn(
                'flex min-h-20 cursor-pointer flex-col gap-0.5 border-b border-line p-1 transition hover:bg-surface md:min-h-28',
                !inMonth && 'opacity-45',
              )}
            >
              <div className="flex items-baseline justify-between px-1">
                <span
                  className={cn(
                    'inline-flex size-6 items-center justify-center rounded-full text-sm font-medium tabular-nums',
                    isToday && 'bg-danger text-white',
                  )}
                >
                  {p.day}
                </span>
                <span className="hidden text-[10px] text-fg-subtle sm:inline">
                  {lunarDay(day, timeZone)}
                </span>
              </div>
              {dayEvents.slice(0, 3).map((e) => (
                <EventChip key={e.key} event={e} onClick={() => onOpenEvent(e)} />
              ))}
              {dayEvents.length > 3 ? (
                <span className="px-1 text-[11px] text-fg-muted">
                  还有 {dayEvents.length - 3} 项
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
