import type { EditScope, EventInput, EventPatch } from '@shared/schemas/calendar'
import type { HomeData } from '@shared/schemas/home'
import type { Todo, TodoInput, TodoPatch } from '@shared/schemas/todos'
import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { errorMessage } from '@/lib/api'
import { homeKeys } from '@/modules/home/queries'
import { toast } from '@/stores/ui'
import { calendarApi } from './api'

export const calendarKeys = {
  events: ['calendar', 'events'] as const,
  range: (from: number, to: number) => ['calendar', 'events', from, to] as const,
  todos: (status: 'open' | 'done') => ['todos', status] as const,
  allTodos: ['todos'] as const,
}

export function useEvents(from: number, to: number) {
  return useQuery({
    queryKey: calendarKeys.range(from, to),
    queryFn: () => calendarApi.events(from, to),
    placeholderData: keepPreviousData,
  })
}

export function useTodos(status: 'open' | 'done' = 'open') {
  return useQuery({
    queryKey: calendarKeys.todos(status),
    queryFn: () => calendarApi.todos(status),
  })
}

export function refreshCalendar(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: calendarKeys.events })
  void qc.invalidateQueries({ queryKey: homeKeys.home })
}

export function refreshTodos(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: calendarKeys.allTodos })
  void qc.invalidateQueries({ queryKey: homeKeys.home })
}

const onError = (error: unknown) => toast.error(errorMessage(error))

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: EventInput) => calendarApi.createEvent(input),
    onSuccess: () => refreshCalendar(qc),
    onError,
  })
}

export function useUpdateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; scope: EditScope; occurrence?: number; patch: EventPatch }) =>
      calendarApi.updateEvent(v.id, v.scope, v.occurrence, v.patch),
    onSuccess: () => refreshCalendar(qc),
    onError,
  })
}

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; scope: EditScope; occurrence?: number }) =>
      calendarApi.deleteEvent(v.id, v.scope, v.occurrence),
    onSuccess: () => refreshCalendar(qc),
    onError,
  })
}

export function useParseQuickEntry() {
  return useMutation({ mutationFn: (text: string) => calendarApi.parse(text), onError })
}

function patchOpenTodos(qc: QueryClient, fn: (todos: Todo[]) => Todo[]): void {
  qc.setQueryData<Todo[]>(calendarKeys.todos('open'), (todos) => (todos ? fn(todos) : todos))
  qc.setQueryData<HomeData>(homeKeys.home, (home) =>
    home ? { ...home, calendar: { ...home.calendar, todos: fn(home.calendar.todos) } } : home,
  )
}

export function useCreateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TodoInput) => calendarApi.createTodo(input),
    onSuccess: () => refreshTodos(qc),
    onError,
  })
}

export function useUpdateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TodoPatch }) =>
      calendarApi.updateTodo(id, patch),
    onSuccess: () => refreshTodos(qc),
    onError,
  })
}

export function useDeleteTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => calendarApi.deleteTodo(id),
    onMutate: (id) => patchOpenTodos(qc, (todos) => todos.filter((t) => t.id !== id)),
    onSettled: () => refreshTodos(qc),
    onError,
  })
}

export function useToggleTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ todo, done }: { todo: Todo; done: boolean }) =>
      calendarApi.setTodoDone(todo.id, done),
    onMutate: ({ todo, done }) => {
      // Recurring todos stay open (they move to the next date), so only hide one-off ones.
      if (done && !todo.rrule) patchOpenTodos(qc, (todos) => todos.filter((t) => t.id !== todo.id))
    },
    onSettled: () => refreshTodos(qc),
    onError,
  })
}
