import {
  DEFAULT_SNOOZE_MINUTES,
  REMINDER_ACTIVE_WINDOW_MS,
  REMINDER_HORIZON_DAYS,
} from '@shared/constants'
import type { Reminder, ReminderPayload, ReminderSourceType } from '@shared/schemas/reminders'
import { DAY_MS, HOUR_MS, MINUTE_MS } from '@shared/time'
import { and, desc, eq, gte, inArray, isNotNull, lt, lte } from 'drizzle-orm'
import { eventParticipants, events, reminders, todos } from '../db/schema'
import type { Deps, UserRow } from '../lib/context'
import { newId } from '../lib/crypto'
import { notFound } from '../lib/errors'
import { expandOccurrences } from './recurrence'
import { getTimeZone } from './settings'

type ReminderRow = typeof reminders.$inferSelect

const HORIZON_MS = REMINDER_HORIZON_DAYS * DAY_MS
// All-day items remind relative to 09:00 on the day rather than midnight.
const ALL_DAY_BASE_MS = 9 * HOUR_MS
// Allows a reminder saved a few seconds late (e.g. "at start" for an event starting now) to fire.
const GRACE_MS = MINUTE_MS

export function toReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    occurrenceAt: row.occurrenceAt,
    fireAt: row.fireAt,
    status: row.status,
    payload: row.payload,
  }
}

type Plan = { occurrenceAt: number; fireAt: number; userId: string; payload: ReminderPayload }

function planForEvent(deps: Deps, eventId: string, now: number): Plan[] {
  const event = deps.db.select().from(events).where(eq(events.id, eventId)).get()
  if (!event || event.remindOffsets.length === 0) return []
  const participants = deps.db
    .select({ userId: eventParticipants.userId })
    .from(eventParticipants)
    .where(eq(eventParticipants.eventId, eventId))
    .all()
    .map((p) => p.userId)
  const recipients = participants.length > 0 ? participants : [event.ownerId]
  const maxOffset = Math.max(...event.remindOffsets) * MINUTE_MS
  const occurrences = expandOccurrences(
    event,
    now - GRACE_MS,
    now + HORIZON_MS + maxOffset,
    getTimeZone(deps),
  )
  const plans: Plan[] = []
  for (const occurrence of occurrences) {
    const base = event.allDay ? occurrence.startAt + ALL_DAY_BASE_MS : occurrence.startAt
    for (const offset of event.remindOffsets) {
      const fireAt = base - offset * MINUTE_MS
      if (fireAt < now - GRACE_MS || fireAt > now + HORIZON_MS) continue
      for (const userId of recipients) {
        plans.push({
          occurrenceAt: occurrence.occurrenceAt,
          fireAt,
          userId,
          payload: {
            title: event.title,
            startAt: occurrence.startAt,
            allDay: event.allDay,
            location: event.location,
            family: event.visibility === 'family',
          },
        })
      }
    }
  }
  return plans
}

function planForTodo(deps: Deps, todoId: string, now: number): Plan[] {
  const todo = deps.db.select().from(todos).where(eq(todos.id, todoId)).get()
  if (!todo || todo.doneAt || todo.dueAt === null || todo.remindOffsets.length === 0) return []
  const recipients = todo.assigneeIds.length > 0 ? todo.assigneeIds : [todo.ownerId]
  const plans: Plan[] = []
  for (const offset of todo.remindOffsets) {
    const fireAt = todo.dueAt - offset * MINUTE_MS
    if (fireAt < now - GRACE_MS || fireAt > now + HORIZON_MS) continue
    for (const userId of recipients) {
      plans.push({
        occurrenceAt: todo.dueAt,
        fireAt,
        userId,
        payload: {
          title: todo.title,
          startAt: todo.dueAt,
          allDay: false,
          location: null,
          family: todo.visibility === 'family',
        },
      })
    }
  }
  return plans
}

/**
 * Replaces the pending reminders of one source. Reminders that already fired are kept, and the
 * same (occurrence, user, time) is never scheduled twice, so edits cannot re-trigger old alerts.
 */
export function regenerateReminders(
  deps: Deps,
  sourceType: ReminderSourceType,
  sourceId: string,
): void {
  const now = deps.now()
  const plans =
    sourceType === 'event' ? planForEvent(deps, sourceId, now) : planForTodo(deps, sourceId, now)
  deps.db.transaction((tx) => {
    tx.delete(reminders)
      .where(
        and(
          eq(reminders.sourceType, sourceType),
          eq(reminders.sourceId, sourceId),
          eq(reminders.status, 'pending'),
        ),
      )
      .run()
    const done = new Set(
      tx
        .select()
        .from(reminders)
        .where(and(eq(reminders.sourceType, sourceType), eq(reminders.sourceId, sourceId)))
        .all()
        .map((r) => `${r.occurrenceAt}|${r.userId}|${r.fireAt}`),
    )
    for (const plan of plans) {
      if (done.has(`${plan.occurrenceAt}|${plan.userId}|${plan.fireAt}`)) continue
      tx.insert(reminders)
        .values({
          id: newId(),
          sourceType,
          sourceId,
          occurrenceAt: plan.occurrenceAt,
          userId: plan.userId,
          fireAt: plan.fireAt,
          status: 'pending',
          firedAt: null,
          payload: plan.payload,
          createdAt: now,
          updatedAt: now,
        })
        .run()
    }
  })
}

export function clearReminders(
  deps: Deps,
  sourceType: ReminderSourceType,
  sourceIds: string[],
): void {
  if (sourceIds.length === 0) return
  deps.db
    .delete(reminders)
    .where(and(eq(reminders.sourceType, sourceType), inArray(reminders.sourceId, sourceIds)))
    .run()
}

/** Marks due reminders as fired and pushes them to online pages. Returns how many fired. */
export function fireDueReminders(deps: Deps): number {
  const now = deps.now()
  const due = deps.db
    .select()
    .from(reminders)
    .where(and(eq(reminders.status, 'pending'), lte(reminders.fireAt, now)))
    .all()
  if (due.length === 0) return 0
  deps.db
    .update(reminders)
    .set({ status: 'fired', firedAt: now, updatedAt: now })
    .where(
      inArray(
        reminders.id,
        due.map((r) => r.id),
      ),
    )
    .run()
  const sentToDevices = new Set<string>()
  for (const row of due) {
    const reminder = toReminder({ ...row, status: 'fired' })
    deps.hub.broadcast('reminder.fired', { reminder }, { kind: 'users', userIds: [row.userId] })
    const key = `${row.sourceType}|${row.sourceId}|${row.occurrenceAt}|${row.fireAt}`
    if (row.payload.family && !sentToDevices.has(key)) {
      sentToDevices.add(key)
      deps.hub.broadcastToDevices('reminder.fired', { reminder })
    }
  }
  return due.length
}

/** Drops reminders missed during a long outage instead of firing a flood of stale alerts. */
export function expireStaleReminders(deps: Deps): void {
  const now = deps.now()
  deps.db
    .update(reminders)
    .set({ status: 'expired', updatedAt: now })
    .where(
      and(eq(reminders.status, 'pending'), lt(reminders.fireAt, now - REMINDER_ACTIVE_WINDOW_MS)),
    )
    .run()
}

/** Extends the scheduling horizon of recurring events and todos; runs daily. */
export function rollReminderHorizon(deps: Deps): void {
  const recurringEvents = deps.db
    .select({ id: events.id })
    .from(events)
    .where(isNotNull(events.rrule))
    .all()
  for (const { id } of recurringEvents) regenerateReminders(deps, 'event', id)
  const farTodos = deps.db
    .select({ id: todos.id })
    .from(todos)
    .where(and(isNotNull(todos.dueAt), gte(todos.dueAt, deps.now() + HORIZON_MS - DAY_MS)))
    .all()
  for (const { id } of farTodos) regenerateReminders(deps, 'todo', id)
}

export function activeReminders(deps: Deps, userId: string): Reminder[] {
  return deps.db
    .select()
    .from(reminders)
    .where(
      and(
        eq(reminders.userId, userId),
        eq(reminders.status, 'fired'),
        gte(reminders.fireAt, deps.now() - REMINDER_ACTIVE_WINDOW_MS),
      ),
    )
    .orderBy(desc(reminders.fireAt))
    .limit(20)
    .all()
    .map(toReminder)
}

function ownReminder(deps: Deps, user: UserRow, id: string): ReminderRow {
  const row = deps.db.select().from(reminders).where(eq(reminders.id, id)).get()
  if (!row || row.userId !== user.id) throw notFound('提醒不存在')
  return row
}

export function dismissReminder(deps: Deps, user: UserRow, id: string): void {
  ownReminder(deps, user, id)
  deps.db
    .update(reminders)
    .set({ status: 'dismissed', updatedAt: deps.now() })
    .where(eq(reminders.id, id))
    .run()
}

export function snoozeReminder(
  deps: Deps,
  user: UserRow,
  id: string,
  minutes = DEFAULT_SNOOZE_MINUTES,
): Reminder {
  const row = ownReminder(deps, user, id)
  const now = deps.now()
  const fireAt = now + minutes * MINUTE_MS
  deps.db
    .update(reminders)
    .set({ status: 'pending', fireAt, firedAt: null, updatedAt: now })
    .where(eq(reminders.id, id))
    .run()
  return toReminder({ ...row, status: 'pending', fireAt })
}
