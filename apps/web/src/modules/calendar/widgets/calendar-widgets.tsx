import type { EventInstance } from '@shared/schemas/calendar'
import { addZonedDays, startOfZonedDay } from '@shared/time'
import { CalendarDays, CalendarRange, Hourglass, ListTodo, Users } from 'lucide-react'
import { z } from 'zod'
import { Field, Select } from '@/components/form'
import { Avatar } from '@/components/misc'
import { cn } from '@/lib/cn'
import {
  formatCountdown,
  formatEventTime,
  formatMonthDay,
  formatTime,
  relativeDayLabel,
} from '@/lib/time'
import { useNow } from '@/lib/use-now'
import { useHomeSlice } from '@/modules/home/queries'
import { useMemberMap, useTimeZone } from '@/modules/settings/queries'
import { FitList } from '@/widgets/fit-list'
import { useReadOnly } from '@/widgets/read-only'
import { type ConfigEditorProps, registerWidget, type WidgetProps } from '@/widgets/registry'
import { WidgetHeader } from '@/widgets/widget-frame'
import { TodoRow } from '../components/todo-list'
import { eventColor, eventMembers, eventsOnDay } from '../lib'

/** Upper bound on rendered rows; FitList then shows as many as the card height allows. */
const MAX_ROWS = 40

function useCalendarHome() {
  return useHomeSlice((d) => d.calendar).data
}

function MiniEvent({
  event,
  showDay,
  now,
}: {
  event: EventInstance
  showDay?: boolean
  now: number
}) {
  const members = useMemberMap()
  const timeZone = useTimeZone()
  const color = eventColor(event, members)
  const past = !event.allDay && event.endAt < now
  return (
    <li className={cn('flex items-stretch gap-2', past && 'opacity-45')}>
      <span className="w-1 shrink-0 rounded-full" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{event.title}</p>
        <p className="truncate text-xs text-fg-muted">
          {showDay ? `${relativeDayLabel(event.startAt, now, timeZone)} ` : ''}
          {formatEventTime(event, timeZone)}
          {event.location ? ` · ${event.location}` : ''}
        </p>
      </div>
    </li>
  )
}

function TodayWidget({ size }: WidgetProps) {
  const calendar = useCalendarHome()
  const timeZone = useTimeZone()
  const now = useNow()
  const today = eventsOnDay(calendar?.instances ?? [], startOfZonedDay(now, timeZone), timeZone)
  const upcoming = today.filter((e) => e.allDay || e.endAt >= now)

  if (size === 'S') {
    const next = upcoming.find((e) => !e.allDay) ?? upcoming[0]
    return (
      <div className="flex h-full flex-col justify-between p-4">
        <WidgetHeader icon={CalendarDays} title="今天" />
        <div>
          <p className="text-4xl font-semibold tabular-nums">{today.length}</p>
          <p className="truncate text-sm text-fg-muted">
            {next ? `下一项：${next.title}` : '项日程'}
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <WidgetHeader icon={CalendarDays} title="今日日程" trailing={`${today.length} 项`} />
      {today.length === 0 ? (
        <p className="m-auto text-sm text-fg-muted">今天没有安排</p>
      ) : (
        <FitList className="gap-y-2">
          {today.slice(0, MAX_ROWS).map((e) => (
            <MiniEvent key={e.key} event={e} now={now} />
          ))}
        </FitList>
      )}
    </div>
  )
}

const upcomingConfig = z.object({ days: z.number().int().min(1).max(14).default(7) })
type UpcomingConfig = z.infer<typeof upcomingConfig>

function UpcomingWidget({ config }: WidgetProps<UpcomingConfig>) {
  const calendar = useCalendarHome()
  const timeZone = useTimeZone()
  const now = useNow()
  const start = startOfZonedDay(now, timeZone)
  const days = Array.from({ length: config.days }, (_, i) => addZonedDays(start, i, timeZone))
    .map((day) => ({ day, events: eventsOnDay(calendar?.instances ?? [], day, timeZone) }))
    .filter((d) => d.events.length > 0)
  // Day headings and events are flattened into one list so FitList can cut between any two rows.
  const rows = days
    .flatMap(({ day, events }) => [
      <li key={`day-${day}`} className="pt-1 text-xs font-semibold text-fg-muted first:pt-0">
        {relativeDayLabel(day, now, timeZone)} · {formatMonthDay(day, timeZone)}
      </li>,
      ...events.map((e) => <MiniEvent key={e.key} event={e} now={now} />),
    ])
    .slice(0, MAX_ROWS)

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <WidgetHeader icon={CalendarRange} title={`未来 ${config.days} 天`} />
      {days.length === 0 ? (
        <p className="m-auto text-sm text-fg-muted">近期没有安排</p>
      ) : (
        <FitList className="gap-y-1.5">{rows}</FitList>
      )}
    </div>
  )
}

function MembersWidget({ size }: WidgetProps) {
  const calendar = useCalendarHome()
  const members = useHomeSlice((d) => d.members).data ?? []
  const timeZone = useTimeZone()
  const now = useNow()
  const today = eventsOnDay(calendar?.instances ?? [], startOfZonedDay(now, timeZone), timeZone)
  const perMember = size === 'XL' ? 8 : 5

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <WidgetHeader icon={Users} title="家人今日安排" />
      <FitList className="gap-y-3">
        {members.map((m) => {
          const mine = today.filter((e) => eventMembers(e).includes(m.id))
          // Avatar rings extend 2px beyond the box; keep them inside FitList's clipped area.
          return (
            <li key={m.id} className="flex gap-2.5 p-[2px]">
              <Avatar user={m} size={28} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{m.name}</p>
                {mine.length === 0 ? (
                  <p className="text-xs text-fg-subtle">暂无安排</p>
                ) : (
                  <ul className="flex flex-col">
                    {mine.slice(0, perMember).map((e) => (
                      <li key={e.key} className="flex gap-2 truncate text-xs">
                        <span className="w-10 shrink-0 text-fg-muted tabular-nums">
                          {e.allDay ? '全天' : formatTime(e.startAt, timeZone)}
                        </span>
                        <span
                          className={cn(
                            'truncate',
                            !e.allDay && e.endAt < now && 'text-fg-subtle line-through',
                          )}
                        >
                          {e.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          )
        })}
      </FitList>
    </div>
  )
}

function NextWidget() {
  const calendar = useCalendarHome()
  const members = useMemberMap()
  const timeZone = useTimeZone()
  const now = useNow(30_000)
  const next = (calendar?.instances ?? []).find((e) => !e.allDay && e.endAt > now)
  return (
    <div className="flex h-full flex-col justify-between p-4">
      <WidgetHeader icon={Hourglass} title="下一项" />
      {next ? (
        <div className="min-w-0">
          <p
            className="truncate text-xl font-semibold whitespace-nowrap tabular-nums"
            style={{ color: eventColor(next, members) }}
          >
            {formatCountdown(next.startAt - now)}
          </p>
          <p className="truncate font-medium">{next.title}</p>
          <p className="truncate text-xs text-fg-muted">
            {relativeDayLabel(next.startAt, now, timeZone)} {formatTime(next.startAt, timeZone)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-fg-muted">两周内没有安排</p>
      )}
    </div>
  )
}

function TodosWidget() {
  const calendar = useCalendarHome()
  const readOnly = useReadOnly()
  const todos = calendar?.todos ?? []
  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <WidgetHeader icon={ListTodo} title="待办" trailing={`${todos.length} 项`} />
      {todos.length === 0 ? (
        <p className="m-auto text-sm text-fg-muted">没有待办</p>
      ) : (
        <FitList>
          {todos.slice(0, MAX_ROWS).map((t) => (
            <TodoRow key={t.id} todo={t} readOnly={readOnly} compact />
          ))}
        </FitList>
      )}
    </div>
  )
}

function DaysEditor({ config, onChange }: ConfigEditorProps<UpcomingConfig>) {
  return (
    <Field label="显示多少天">
      <Select value={config.days} onChange={(e) => onChange({ days: Number(e.target.value) })}>
        {[3, 5, 7, 10, 14].map((d) => (
          <option key={d} value={d}>
            {d} 天
          </option>
        ))}
      </Select>
    </Field>
  )
}

registerWidget({
  type: 'calendar.today',
  title: '今日日程',
  description: '今天的所有安排',
  group: '日程',
  icon: CalendarDays,
  sizes: ['S', 'M', 'L'],
  defaultSize: 'M',
  configSchema: z.object({}),
  component: TodayWidget,
  drawer: 'calendar',
})

registerWidget({
  type: 'calendar.upcoming',
  title: '近期日程',
  description: '按天分组显示未来几天的安排',
  group: '日程',
  icon: CalendarRange,
  sizes: ['M', 'L', 'XL'],
  defaultSize: 'L',
  configSchema: upcomingConfig,
  component: UpcomingWidget,
  ConfigEditor: DaysEditor,
  drawer: 'calendar',
})

registerWidget({
  type: 'calendar.members',
  title: '家人今日安排',
  description: '按成员分开显示今天各自的日程',
  group: '日程',
  icon: Users,
  sizes: ['L', 'XL'],
  defaultSize: 'L',
  configSchema: z.object({}),
  component: MembersWidget,
  drawer: 'calendar',
})

registerWidget({
  type: 'calendar.next',
  title: '下一项',
  description: '距离下一个日程还有多久',
  group: '日程',
  icon: Hourglass,
  sizes: ['S'],
  defaultSize: 'S',
  configSchema: z.object({}),
  component: NextWidget,
  drawer: 'calendar',
})

registerWidget({
  type: 'todos.open',
  title: '待办',
  description: '还没完成的待办，可直接勾选',
  group: '日程',
  icon: ListTodo,
  sizes: ['M', 'L', 'XL'],
  defaultSize: 'M',
  configSchema: z.object({}),
  component: TodosWidget,
  drawer: 'calendar',
})
