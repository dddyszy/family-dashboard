import { useQueryClient } from '@tanstack/react-query'
import { lazy } from 'react'
import { registerDrawer } from '@/app/drawers'
import { useRealtime } from '@/lib/realtime'
import { refreshCalendar, refreshTodos } from './queries'
import './widgets/calendar-widgets'

registerDrawer({
  name: 'calendar',
  title: '日程与待办',
  component: lazy(() =>
    import('./drawer/calendar-drawer').then((m) => ({ default: m.CalendarDrawer })),
  ),
})

export function useCalendarRealtime(): void {
  const qc = useQueryClient()
  useRealtime('calendar.changed', () => refreshCalendar(qc))
  useRealtime('todo.changed', () => refreshTodos(qc))
}
