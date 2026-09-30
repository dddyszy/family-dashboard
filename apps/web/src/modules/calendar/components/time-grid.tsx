import type { EventInstance } from '@shared/schemas/calendar'
import { addZonedDays, dateKey, getZonedParts, HOUR_MS } from '@shared/time'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import { formatTime, weekdayLabel } from '@/lib/time'
import { useMemberMap } from '@/modules/settings/queries'
import { eventColor, eventsOnDay, layoutDay } from '../lib'

const HOUR_HEIGHT = 52
const HOURS = Array.from({ length: 24 }, (_, h) => h)

export function TimeGrid({
  dayStarts,
  instances,
  now,
  timeZone,
  onCreateAt,
  onOpenEvent,
}: {
  dayStarts: number[]
  instances: EventInstance[]
  now: number
  timeZone: string
  onCreateAt: (startAt: number) => void
  onOpenEvent: (event: EventInstance) => void
}) {
  const members = useMemberMap()
  const scrollRef = useRef<HTMLDivElement>(null)
  const todayKey = dateKey(now, timeZone)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: HOUR_HEIGHT * 7 })
  }, [])

  const columns = dayStarts.map((day) => {
    const dayEvents = eventsOnDay(instances, day, timeZone)
    return {
      day,
      allDay: dayEvents.filter((e) => e.allDay || e.endAt - e.startAt >= 24 * HOUR_MS),
      timed: layoutDay(dayEvents.filter((e) => !e.allDay && e.endAt - e.startAt < 24 * HOUR_MS)),
    }
  })
  const nowParts = getZonedParts(now, timeZone)
  const nowOffset = (nowParts.hour + nowParts.minute / 60) * HOUR_HEIGHT

  return (
    <div className="flex flex-col">
      <div className="flex border-b border-line pb-2">
        <div className="w-12 shrink-0" />
        {columns.map(({ day, allDay }) => {
          const p = getZonedParts(day, timeZone)
          const isToday = dateKey(day, timeZone) === todayKey
          return (
            <div key={day} className="min-w-0 flex-1 px-0.5">
              <div className="mb-1 flex flex-col items-center">
                <span className="text-xs text-fg-muted">{weekdayLabel(day, timeZone)}</span>
                <span
                  className={cn(
                    'inline-flex size-8 items-center justify-center rounded-full text-lg font-semibold tabular-nums',
                    isToday && 'bg-danger text-white',
                  )}
                >
                  {p.day}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                {allDay.map((e) => {
                  const color = eventColor(e, members)
                  return (
                    <button
                      key={e.key}
                      type="button"
                      onClick={() => onOpenEvent(e)}
                      className="truncate rounded-md px-1.5 py-0.5 text-left text-xs font-medium"
                      style={{ background: `${color}33` }}
                    >
                      {e.title}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <div ref={scrollRef} className="relative max-h-[65dvh] overflow-y-auto">
        <div className="flex" style={{ height: HOUR_HEIGHT * 24 }}>
          <div className="relative w-12 shrink-0">
            {HOURS.map((h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-fg-subtle tabular-nums"
                style={{ top: h * HOUR_HEIGHT }}
              >
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </span>
            ))}
          </div>
          {columns.map(({ day, timed }) => {
            const isToday = dateKey(day, timeZone) === todayKey
            return (
              <div key={day} className="relative min-w-0 flex-1 border-l border-line">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    aria-label={`在 ${h} 点新建日程`}
                    onClick={() => onCreateAt(day + h * HOUR_MS)}
                    className="absolute inset-x-0 border-t border-line hover:bg-surface"
                    style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                  />
                ))}
                {timed.map(({ event, column, columns: total }) => {
                  const start = Math.max(event.startAt, day)
                  const end = Math.min(
                    Math.max(event.endAt, event.startAt + 20 * 60_000),
                    addZonedDays(day, 1, timeZone),
                  )
                  const top = ((start - day) / HOUR_MS) * HOUR_HEIGHT
                  const height = Math.max(20, ((end - start) / HOUR_MS) * HOUR_HEIGHT - 2)
                  const color = eventColor(event, members)
                  return (
                    <button
                      key={event.key}
                      type="button"
                      onClick={() => onOpenEvent(event)}
                      className="absolute overflow-hidden rounded-lg border-l-[3px] px-1.5 py-0.5 text-left text-xs shadow-sm"
                      style={{
                        top,
                        height,
                        left: `calc(${(column / total) * 100}% + 2px)`,
                        width: `calc(${100 / total}% - 4px)`,
                        background: `${color}2e`,
                        borderColor: color,
                      }}
                    >
                      <span className="block truncate font-medium">{event.title}</span>
                      {height > 32 ? (
                        <span className="block truncate text-fg-muted">
                          {formatTime(event.startAt, timeZone)}
                          {event.location ? ` · ${event.location}` : ''}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
                {isToday ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10"
                    style={{ top: nowOffset }}
                  >
                    <div className="relative h-0.5 bg-danger">
                      <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-danger" />
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
