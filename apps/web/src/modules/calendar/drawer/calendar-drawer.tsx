import { addZonedDays, startOfZonedDay } from '@shared/time'
import { CalendarCheck } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/misc'
import { formatFullDate } from '@/lib/time'
import { useNow } from '@/lib/use-now'
import { useHomeSlice } from '@/modules/home/queries'
import { useTimeZone } from '@/modules/settings/queries'
import { useUi } from '@/stores/ui'
import { EventRow } from '../components/event-chip'
import { QuickEntry } from '../components/quick-entry'
import { TodoList, TodoQuickAdd } from '../components/todo-list'
import { eventsOnDay } from '../lib'
import { useCalendarUi } from '../store'

export function CalendarDrawer({ props }: { props?: Record<string, unknown> }) {
  const readOnly = props?.readOnly === true
  const timeZone = useTimeZone()
  const now = useNow()
  const calendar = useHomeSlice((d) => d.calendar).data
  const openEditor = useCalendarUi((s) => s.openEditor)
  const closeDrawer = useUi((s) => s.closeDrawer)
  const today = startOfZonedDay(now, timeZone)
  const tomorrow = addZonedDays(today, 1, timeZone)
  const todayEvents = eventsOnDay(calendar?.instances ?? [], today, timeZone)
  const tomorrowEvents = eventsOnDay(calendar?.instances ?? [], tomorrow, timeZone)
  const open = readOnly
    ? undefined
    : (e: (typeof todayEvents)[number]) => openEditor({ kind: 'edit', instance: e })

  return (
    <div className="flex flex-col gap-5">
      {readOnly ? null : <QuickEntry />}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-semibold">今天</h3>
          <span className="text-xs text-fg-muted">{formatFullDate(now, timeZone)}</span>
        </div>
        {todayEvents.length ? (
          <div className="flex flex-col">
            {todayEvents.map((e) => (
              <EventRow key={e.key} event={e} onClick={open ? () => open(e) : undefined} />
            ))}
          </div>
        ) : (
          <EmptyState icon={CalendarCheck} title="今天没有安排" className="py-4" />
        )}
      </section>
      {tomorrowEvents.length ? (
        <section>
          <h3 className="mb-2 font-semibold">明天</h3>
          <div className="flex flex-col">
            {tomorrowEvents.map((e) => (
              <EventRow key={e.key} event={e} onClick={open ? () => open(e) : undefined} />
            ))}
          </div>
        </section>
      ) : null}
      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">待办</h3>
        {readOnly ? null : <TodoQuickAdd />}
        <TodoList todos={calendar?.todos ?? []} readOnly={readOnly} />
      </section>
      {readOnly ? null : (
        <Link
          to="/calendar"
          onClick={closeDrawer}
          className="text-center text-sm text-accent hover:underline"
        >
          打开完整日程
        </Link>
      )}
    </div>
  )
}
