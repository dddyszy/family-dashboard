import type { EventInstance } from '@shared/schemas/calendar'
import { Repeat } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatEventTime, formatTime } from '@/lib/time'
import { useMemberMap, useTimeZone } from '@/modules/settings/queries'
import { eventColor } from '../lib'

/** Compact single-line event used in month cells. */
export function EventChip({ event, onClick }: { event: EventInstance; onClick?: () => void }) {
  const members = useMemberMap()
  const timeZone = useTimeZone()
  const color = eventColor(event, members)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className="flex w-full items-center gap-1 truncate rounded-md px-1 py-0.5 text-left text-[11px] leading-tight hover:bg-surface-hover md:text-xs"
      style={event.allDay ? { background: `${color}33` } : undefined}
    >
      {event.allDay ? null : (
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
      )}
      {event.allDay ? null : (
        <span className="shrink-0 text-fg-subtle tabular-nums">
          {formatTime(event.startAt, timeZone)}
        </span>
      )}
      <span className="truncate">{event.title}</span>
    </button>
  )
}

/** Row with colour bar used in agenda lists, drawers and widgets. */
export function EventRow({
  event,
  onClick,
  dense,
}: {
  event: EventInstance
  onClick?: () => void
  dense?: boolean
}) {
  const members = useMemberMap()
  const timeZone = useTimeZone()
  const color = eventColor(event, members)
  const people = event.participantIds.map((id) => members.get(id)?.name).filter(Boolean)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      disabled={!onClick}
      className={cn(
        'no-drag flex w-full items-stretch gap-2.5 rounded-xl text-left transition',
        onClick && 'hover:bg-surface',
        dense ? 'py-1' : 'px-2 py-2',
      )}
    >
      <span className="w-1 shrink-0 rounded-full" style={{ background: color }} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span className={cn('truncate font-medium', dense && 'text-sm')}>{event.title}</span>
          {event.rrule || event.parentId ? (
            <Repeat className="size-3 shrink-0 text-fg-subtle" />
          ) : null}
        </span>
        <span className="block truncate text-xs text-fg-muted">
          {formatEventTime(event, timeZone)}
          {event.location ? ` · ${event.location}` : ''}
          {!dense && people.length ? ` · ${people.join('、')}` : ''}
        </span>
      </span>
    </button>
  )
}
