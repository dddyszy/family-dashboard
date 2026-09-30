import type { Todo, TodoInput, TodoPatch } from '@shared/schemas/todos'
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { todos, users } from '../db/schema'
import type { Deps, UserRow } from '../lib/context'
import { newId } from '../lib/crypto'
import { forbidden, notFound } from '../lib/errors'
import { audienceFor, canEdit, canView, type Viewer, visibleWhere } from '../lib/visibility'
import { nextOccurrence } from './recurrence'
import { clearReminders, regenerateReminders } from './reminders'
import { getTimeZone } from './settings'

type TodoRow = typeof todos.$inferSelect

function toTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    ownerId: row.ownerId,
    visibility: row.visibility,
    title: row.title,
    note: row.note,
    dueAt: row.dueAt,
    rrule: row.rrule,
    assigneeIds: row.assigneeIds,
    remindOffsets: row.remindOffsets,
    doneAt: row.doneAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

const assigneeCondition = (userId: string) =>
  sql`exists (select 1 from json_each("todos"."assignee_ids") where value = ${userId})`

export function listTodos(
  deps: Deps,
  viewer: Viewer,
  status: 'open' | 'done',
  limit = 200,
): Todo[] {
  const done = status === 'done'
  return deps.db
    .select()
    .from(todos)
    .where(
      and(
        visibleWhere(todos, viewer, assigneeCondition),
        done ? isNotNull(todos.doneAt) : isNull(todos.doneAt),
      ),
    )
    .orderBy(
      ...(done
        ? [desc(todos.doneAt)]
        : [
            sql`case when ${todos.dueAt} is null then 1 else 0 end`,
            asc(todos.dueAt),
            asc(todos.createdAt),
          ]),
    )
    .limit(limit)
    .all()
    .map(toTodo)
}

function validAssignees(deps: Deps, ids: readonly string[]): string[] {
  if (ids.length === 0) return []
  const existing = new Set(
    deps.db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, [...ids]))
      .all()
      .map((u) => u.id),
  )
  return [...new Set(ids)].filter((id) => existing.has(id))
}

function editable(deps: Deps, user: UserRow, id: string): TodoRow {
  const row = deps.db.select().from(todos).where(eq(todos.id, id)).get()
  const viewer: Viewer = { kind: 'user', userId: user.id }
  if (!row || !canView(row, viewer, row.assigneeIds)) throw notFound('待办不存在')
  if (!canEdit(row, viewer) && !row.assigneeIds.includes(user.id))
    throw forbidden('只有创建者可以修改私有待办')
  return row
}

function broadcast(deps: Deps, rows: TodoRow[]): void {
  const sent = new Set<string>()
  for (const row of rows) {
    const audience = audienceFor(row, row.assigneeIds)
    const key = JSON.stringify(audience)
    if (sent.has(key)) continue
    sent.add(key)
    deps.hub.broadcast('todo.changed', {}, audience)
  }
}

export function createTodo(deps: Deps, user: UserRow, input: TodoInput): Todo {
  const ts = deps.now()
  const row: TodoRow = {
    id: newId(),
    ownerId: user.id,
    visibility: input.visibility,
    title: input.title,
    note: input.note ?? null,
    dueAt: input.dueAt ?? null,
    rrule: input.dueAt ? (input.rrule ?? null) : null,
    assigneeIds: validAssignees(deps, input.assigneeIds),
    remindOffsets: [...new Set(input.remindOffsets)].sort((a, b) => a - b),
    doneAt: null,
    createdAt: ts,
    updatedAt: ts,
  }
  deps.db.insert(todos).values(row).run()
  regenerateReminders(deps, 'todo', row.id)
  broadcast(deps, [row])
  return toTodo(row)
}

export function updateTodo(deps: Deps, user: UserRow, id: string, patch: TodoPatch): Todo {
  const before = editable(deps, user, id)
  if (patch.visibility && patch.visibility !== before.visibility && before.ownerId !== user.id) {
    throw forbidden('只有创建者可以修改待办的共享范围')
  }
  const changes: Partial<TodoRow> = { updatedAt: deps.now() }
  if (patch.title !== undefined) changes.title = patch.title
  if (patch.note !== undefined) changes.note = patch.note
  if (patch.dueAt !== undefined) changes.dueAt = patch.dueAt
  if (patch.rrule !== undefined) changes.rrule = patch.rrule
  if (patch.visibility !== undefined) changes.visibility = patch.visibility
  if (patch.assigneeIds !== undefined) changes.assigneeIds = validAssignees(deps, patch.assigneeIds)
  if (patch.remindOffsets !== undefined) {
    changes.remindOffsets = [...new Set(patch.remindOffsets)].sort((a, b) => a - b)
  }
  if ((changes.dueAt ?? before.dueAt) === null) changes.rrule = null
  deps.db.update(todos).set(changes).where(eq(todos.id, id)).run()
  const after = { ...before, ...changes }
  regenerateReminders(deps, 'todo', id)
  broadcast(deps, [before, after])
  return toTodo(after)
}

/**
 * Completing a recurring todo moves it to its next due date instead of closing it, so a chore
 * like "every Friday" stays on the list.
 */
export function setTodoDone(deps: Deps, user: UserRow, id: string, done: boolean): Todo {
  const row = editable(deps, user, id)
  const now = deps.now()
  let changes: Partial<TodoRow>
  if (done && row.rrule && row.dueAt !== null) {
    const next = nextOccurrence(row.rrule, row.dueAt, Math.max(row.dueAt, now), getTimeZone(deps))
    changes = next === null ? { doneAt: now } : { dueAt: next }
  } else {
    changes = { doneAt: done ? now : null }
  }
  deps.db
    .update(todos)
    .set({ ...changes, updatedAt: now })
    .where(eq(todos.id, id))
    .run()
  const after = { ...row, ...changes, updatedAt: now }
  regenerateReminders(deps, 'todo', id)
  broadcast(deps, [after])
  return toTodo(after)
}

export function deleteTodo(deps: Deps, user: UserRow, id: string): void {
  const row = editable(deps, user, id)
  deps.db.delete(todos).where(eq(todos.id, id)).run()
  clearReminders(deps, 'todo', [id])
  broadcast(deps, [row])
}
