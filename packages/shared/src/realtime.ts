import type { Reminder } from './schemas/reminders'
import type { ShoppingItem } from './schemas/shopping'

export type RealtimeEvents = {
  'shopping.list.changed': { listId: string | null }
  'shopping.item.created': { listId: string; item: ShoppingItem }
  'shopping.item.updated': { listId: string; item: ShoppingItem }
  'shopping.item.deleted': { listId: string; itemId: string }
  'shopping.items.cleared': { listId: string }
  'calendar.changed': Record<string, never>
  'todo.changed': Record<string, never>
  'dashboard.changed': { dashboardId: string }
  'members.changed': Record<string, never>
  'settings.changed': Record<string, never>
  'reminder.fired': { reminder: Reminder }
}

export type RealtimeEventName = keyof RealtimeEvents

export const REALTIME_EVENT_NAMES: RealtimeEventName[] = [
  'shopping.list.changed',
  'shopping.item.created',
  'shopping.item.updated',
  'shopping.item.deleted',
  'shopping.items.cleared',
  'calendar.changed',
  'todo.changed',
  'dashboard.changed',
  'members.changed',
  'settings.changed',
  'reminder.fired',
]
