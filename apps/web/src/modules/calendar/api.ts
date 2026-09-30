import type {
  CalendarEvent,
  EditScope,
  EventInput,
  EventInstance,
  EventPatch,
  QuickEntryDraft,
} from '@shared/schemas/calendar'
import type { Reminder } from '@shared/schemas/reminders'
import type { Todo, TodoInput, TodoPatch } from '@shared/schemas/todos'
import { api } from '@/lib/api'

function scopeQuery(scope: EditScope, occurrence?: number): string {
  const params = new URLSearchParams({ scope })
  if (occurrence !== undefined) params.set('occurrence', String(occurrence))
  return params.toString()
}

export const calendarApi = {
  events: (from: number, to: number) => api.get<EventInstance[]>(`/events?from=${from}&to=${to}`),
  createEvent: (input: EventInput) => api.post<CalendarEvent>('/events', input),
  updateEvent: (id: string, scope: EditScope, occurrence: number | undefined, patch: EventPatch) =>
    api.patch<CalendarEvent>(`/events/${id}?${scopeQuery(scope, occurrence)}`, patch),
  deleteEvent: (id: string, scope: EditScope, occurrence?: number) =>
    api.delete<{ ok: true }>(`/events/${id}?${scopeQuery(scope, occurrence)}`),
  parse: (text: string) => api.post<QuickEntryDraft>('/parse', { text }),
  todos: (status: 'open' | 'done') => api.get<Todo[]>(`/todos?status=${status}`),
  createTodo: (input: TodoInput) => api.post<Todo>('/todos', input),
  updateTodo: (id: string, patch: TodoPatch) => api.patch<Todo>(`/todos/${id}`, patch),
  deleteTodo: (id: string) => api.delete<{ ok: true }>(`/todos/${id}`),
  setTodoDone: (id: string, done: boolean) => api.post<Todo>(`/todos/${id}/done`, { done }),
  activeReminders: () => api.get<Reminder[]>('/reminders/active'),
  dismissReminder: (id: string) => api.post<{ ok: true }>(`/reminders/${id}/dismiss`),
  snoozeReminder: (id: string, minutes?: number) =>
    api.post<Reminder>(`/reminders/${id}/snooze`, { minutes }),
}
