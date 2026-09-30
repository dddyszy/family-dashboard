import type { EventInstance } from '@shared/schemas/calendar'
import { addZonedDays, getZonedParts, HOUR_MS, startOfZonedDay } from '@shared/time'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Spinner } from '@/components/button'
import { Segmented } from '@/components/form'
import { Glass } from '@/components/glass'
import { Avatar } from '@/components/misc'
import { cn } from '@/lib/cn'
import { formatMonthDay } from '@/lib/time'
import { useNow } from '@/lib/use-now'
import { useMembers, useTimeZone } from '@/modules/settings/queries'
import { AgendaView } from '../components/agenda-view'
import { MonthView } from '../components/month-view'
import { QuickEntry } from '../components/quick-entry'
import { TimeGrid } from '../components/time-grid'
import { TodoList, TodoQuickAdd } from '../components/todo-list'
import { addMonths, filterByMembers, startOfMonth, startOfWeek } from '../lib'
import { useEvents, useTodos } from '../queries'
import { useCalendarUi } from '../store'

type View = 'month' | 'week' | 'day' | 'agenda'

const AGENDA_DAYS = 30

export function CalendarPage() {
  const timeZone = useTimeZone()
  const now = useNow()
  const { data: members = [] } = useMembers()
  const [view, setView] = useState<View>(() => (window.innerWidth < 768 ? 'agenda' : 'month'))
  const [cursor, setCursor] = useState(() => startOfZonedDay(Date.now(), timeZone))
  const [memberFilter, setMemberFilter] = useState<string[]>([])
  const [showDone, setShowDone] = useState(false)
  const { openEditor, openTodoEditor } = useCalendarUi()

  const range = useMemo(() => {
    if (view === 'month') {
      const monthStart = startOfMonth(cursor, timeZone)
      const gridStart = startOfWeek(monthStart, timeZone)
      return { from: gridStart, to: addZonedDays(gridStart, 42, timeZone), monthStart, gridStart }
    }
    if (view === 'week') {
      const from = startOfWeek(cursor, timeZone)
      return { from, to: addZonedDays(from, 7, timeZone), monthStart: from, gridStart: from }
    }
    if (view === 'day') {
      return {
        from: cursor,
        to: addZonedDays(cursor, 1, timeZone),
        monthStart: cursor,
        gridStart: cursor,
      }
    }
    return {
      from: cursor,
      to: addZonedDays(cursor, AGENDA_DAYS, timeZone),
      monthStart: cursor,
      gridStart: cursor,
    }
  }, [view, cursor, timeZone])

  const events = useEvents(range.from, range.to)
  const todos = useTodos(showDone ? 'done' : 'open')
  const instances = filterByMembers(events.data ?? [], memberFilter)

  const move = (direction: 1 | -1) => {
    if (view === 'month') setCursor(addMonths(cursor, direction, timeZone))
    else if (view === 'week') setCursor(addZonedDays(cursor, 7 * direction, timeZone))
    else if (view === 'day') setCursor(addZonedDays(cursor, direction, timeZone))
    else setCursor(addZonedDays(cursor, AGENDA_DAYS * direction, timeZone))
  }

  const p = getZonedParts(view === 'month' ? range.monthStart : cursor, timeZone)
  const title =
    view === 'month' || view === 'agenda'
      ? `${p.year}年${p.month}月`
      : view === 'week'
        ? `${formatMonthDay(range.from, timeZone)} – ${formatMonthDay(addZonedDays(range.to, -1, timeZone), timeZone)}`
        : `${p.month}月${p.day}日`

  const openEvent = (instance: EventInstance) => openEditor({ kind: 'edit', instance })
  const createAt = (startAt: number) =>
    openEditor({ kind: 'new', draft: { startAt, endAt: startAt + HOUR_MS } })
  const newEvent = () => {
    const base =
      startOfZonedDay(cursor, timeZone) === startOfZonedDay(now, timeZone)
        ? now
        : cursor + 9 * HOUR_MS
    const startAt = Math.ceil(base / HOUR_MS) * HOUR_MS
    createAt(startAt)
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'month', label: '月' },
            { value: 'week', label: '周' },
            { value: 'day', label: '日' },
            { value: 'agenda', label: '列表' },
          ]}
        />
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => move(-1)} aria-label="上一页">
            <ChevronLeft className="size-5" />
          </Button>
          <Button size="sm" onClick={() => setCursor(startOfZonedDay(Date.now(), timeZone))}>
            今天
          </Button>
          <Button size="icon" variant="ghost" onClick={() => move(1)} aria-label="下一页">
            <ChevronRight className="size-5" />
          </Button>
        </div>
        <Button variant="primary" onClick={newEvent}>
          <Plus className="size-4" />
          新建
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <QuickEntry />
          {members.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-fg-muted">只看：</span>
              {members.map((m) => {
                const active = memberFilter.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setMemberFilter(
                        active ? memberFilter.filter((id) => id !== m.id) : [...memberFilter, m.id],
                      )
                    }
                    className={cn(
                      'pressable flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-sm transition',
                      active
                        ? 'bg-surface-strong text-fg shadow-sm'
                        : 'text-fg-muted hover:bg-surface',
                    )}
                  >
                    <Avatar user={m} size={22} />
                    {m.name}
                  </button>
                )
              })}
            </div>
          ) : null}
          <Glass className="p-3 md:p-4">
            {!events.data ? (
              <div className="flex justify-center py-16">
                <Spinner className="size-6 text-fg-subtle" />
              </div>
            ) : view === 'month' ? (
              <MonthView
                gridStart={range.gridStart}
                monthStart={range.monthStart}
                instances={instances}
                now={now}
                timeZone={timeZone}
                onSelectDay={(day) => {
                  setCursor(day)
                  setView('day')
                }}
                onOpenEvent={openEvent}
              />
            ) : view === 'agenda' ? (
              <AgendaView
                from={range.from}
                days={AGENDA_DAYS}
                instances={instances}
                now={now}
                timeZone={timeZone}
                onOpenEvent={openEvent}
              />
            ) : (
              <TimeGrid
                dayStarts={Array.from({ length: view === 'week' ? 7 : 1 }, (_, i) =>
                  addZonedDays(range.from, i, timeZone),
                )}
                instances={instances}
                now={now}
                timeZone={timeZone}
                onCreateAt={createAt}
                onOpenEvent={openEvent}
              />
            )}
          </Glass>
        </div>

        <Glass className="flex h-fit flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">待办</h2>
            <div className="flex items-center gap-1">
              <Segmented
                value={showDone ? 'done' : 'open'}
                onChange={(v) => setShowDone(v === 'done')}
                options={[
                  { value: 'open', label: '未完成' },
                  { value: 'done', label: '已完成' },
                ]}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => openTodoEditor({ kind: 'new' })}
                aria-label="新建待办"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
          {showDone ? null : <TodoQuickAdd />}
          <TodoList todos={todos.data ?? []} />
        </Glass>
      </div>
    </div>
  )
}
