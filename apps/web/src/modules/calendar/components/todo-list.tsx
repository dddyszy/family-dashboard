import type { Todo } from '@shared/schemas/todos'
import { Check, ListTodo, Repeat } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Input } from '@/components/form'
import { AvatarStack, EmptyState } from '@/components/misc'
import { cn } from '@/lib/cn'
import { formatTime, relativeDayLabel } from '@/lib/time'
import { useNow } from '@/lib/use-now'
import { useMemberMap, useTimeZone } from '@/modules/settings/queries'
import { useCreateTodo, useToggleTodo } from '../queries'
import { useCalendarUi } from '../store'

export function dueLabel(todo: Todo, now: number, timeZone: string): string | null {
  if (todo.dueAt === null) return null
  return `${relativeDayLabel(todo.dueAt, now, timeZone)} ${formatTime(todo.dueAt, timeZone)}`
}

export function TodoRow({
  todo,
  readOnly,
  compact,
}: {
  todo: Todo
  readOnly?: boolean
  compact?: boolean
}) {
  const toggle = useToggleTodo()
  const openTodoEditor = useCalendarUi((s) => s.openTodoEditor)
  const members = useMemberMap()
  const timeZone = useTimeZone()
  const now = useNow()
  const done = todo.doneAt !== null
  const overdue = !done && todo.dueAt !== null && todo.dueAt < now
  const assignees = todo.assigneeIds.map((id) => members.get(id)).filter((m) => m !== undefined)
  const due = dueLabel(todo, now, timeZone)

  return (
    <li
      className={cn(
        'flex items-center gap-2.5',
        compact ? 'py-1' : 'rounded-2xl bg-surface px-3 py-2.5',
      )}
    >
      <button
        type="button"
        disabled={readOnly}
        onClick={(e) => {
          e.stopPropagation()
          toggle.mutate({ todo, done: !done })
        }}
        aria-label={done ? `标记「${todo.title}」为未完成` : `完成「${todo.title}」`}
        className={cn(
          'no-drag pressable inline-flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition',
          done ? 'border-success bg-success text-white' : 'border-fg-subtle hover:border-success',
        )}
      >
        {done ? <Check className="size-3" strokeWidth={3} /> : null}
      </button>
      <button
        type="button"
        disabled={readOnly}
        onClick={(e) => {
          e.stopPropagation()
          openTodoEditor({ kind: 'edit', todo })
        }}
        className="no-drag min-w-0 flex-1 text-left"
      >
        <p className={cn('truncate', done && 'text-fg-subtle line-through')}>{todo.title}</p>
        {due && !compact ? (
          <p
            className={cn(
              'flex items-center gap-1 text-xs',
              overdue ? 'text-danger' : 'text-fg-muted',
            )}
          >
            {todo.rrule ? <Repeat className="size-3" /> : null}
            {overdue ? '已过期 · ' : ''}
            {due}
          </p>
        ) : null}
      </button>
      {compact && due ? (
        <span className={cn('shrink-0 text-xs', overdue ? 'text-danger' : 'text-fg-subtle')}>
          {relativeDayLabel(todo.dueAt ?? now, now, timeZone)}
        </span>
      ) : null}
      {assignees.length > 0 ? <AvatarStack users={assignees} size={compact ? 18 : 22} /> : null}
    </li>
  )
}

export function TodoQuickAdd() {
  const [title, setTitle] = useState('')
  const create = useCreateTodo()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = title.trim()
    if (!value) return
    create.mutate({ title: value, visibility: 'family', assigneeIds: [], remindOffsets: [] })
    setTitle('')
  }
  return (
    <form onSubmit={submit}>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="添加待办，回车保存"
      />
    </form>
  )
}

export function TodoList({ todos, readOnly }: { todos: Todo[]; readOnly?: boolean }) {
  if (todos.length === 0) return <EmptyState icon={ListTodo} title="没有待办" className="py-6" />
  return (
    <ul className="flex flex-col gap-1.5">
      {todos.map((todo) => (
        <TodoRow key={todo.id} todo={todo} readOnly={readOnly} />
      ))}
    </ul>
  )
}
