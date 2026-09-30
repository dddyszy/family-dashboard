import { addZonedDays, startOfZonedDay } from '@shared/time'
import { listEventsInRange } from '../services/calendar'
import { getTimeZone } from '../services/settings'
import { listLists, pendingItemsByList } from '../services/shopping'
import { listTodos } from '../services/todos'
import { listUsers } from '../services/users'
import { registerHomeContributor } from './registry'

const CALENDAR_DAYS = 14

registerHomeContributor('members', ({ deps }) => listUsers(deps))

registerHomeContributor('calendar', ({ deps, viewer }) => {
  const timeZone = getTimeZone(deps)
  const rangeStart = startOfZonedDay(deps.now(), timeZone)
  const rangeEnd = addZonedDays(rangeStart, CALENDAR_DAYS, timeZone)
  return {
    rangeStart,
    rangeEnd,
    instances: listEventsInRange(deps, viewer, rangeStart, rangeEnd),
    todos: listTodos(deps, viewer, 'open', 50),
  }
})

registerHomeContributor('shopping', ({ deps, viewer }) => {
  const lists = listLists(deps, viewer)
  return {
    lists,
    pendingItems: pendingItemsByList(
      deps,
      lists.map((l) => l.id),
    ),
  }
})
