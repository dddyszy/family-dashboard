import { stripLimits } from '@shared/recurrence'
import type {
  CalendarEvent,
  EditScope,
  EventInput,
  EventInstance,
  EventPatch,
} from '@shared/schemas/calendar'
import { and, asc, eq, gte, inArray, isNotNull, lt, or, sql } from 'drizzle-orm'
import { eventParticipants, events, users } from '../db/schema'
import type { Deps, UserRow } from '../lib/context'
import { newId } from '../lib/crypto'
import { badRequest, forbidden, notFound } from '../lib/errors'
import { audienceFor, canEdit, canView, type Viewer, visibleWhere } from '../lib/visibility'
import { expandOccurrences, hasOccurrences, truncateRrule } from './recurrence'
import { clearReminders, regenerateReminders } from './reminders'
import { getTimeZone } from './settings'

type EventRow = typeof events.$inferSelect

function participantsOf(deps: Deps, eventIds: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  if (eventIds.length === 0) return map
  const rows = deps.db
    .select()
    .from(eventParticipants)
    .where(inArray(eventParticipants.eventId, eventIds))
    .all()
  for (const row of rows) map.set(row.eventId, [...(map.get(row.eventId) ?? []), row.userId])
  return map
}

function toEvent(row: EventRow, participantIds: string[]): CalendarEvent {
  return {
    id: row.id,
    ownerId: row.ownerId,
    visibility: row.visibility,
    title: row.title,
    location: row.location,
    note: row.note,
    color: row.color,
    startAt: row.startAt,
    endAt: row.endAt,
    allDay: row.allDay,
    rrule: row.rrule,
    exdates: row.exdates,
    parentId: row.parentId,
    recurrenceId: row.recurrenceId,
    remindOffsets: row.remindOffsets,
    participantIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

const participantCondition = (userId: string) =>
  sql`exists (select 1 from "event_participants" as "ep" where "ep"."event_id" = "events"."id" and "ep"."user_id" = ${userId})`

export function listEventsInRange(
  deps: Deps,
  viewer: Viewer,
  from: number,
  to: number,
): EventInstance[] {
  const rows = deps.db
    .select()
    .from(events)
    .where(
      and(
        visibleWhere(events, viewer, participantCondition),
        lt(events.startAt, to),
        or(isNotNull(events.rrule), gte(events.endAt, from)),
      ),
    )
    .orderBy(asc(events.startAt))
    .all()
  const participants = participantsOf(
    deps,
    rows.map((r) => r.id),
  )
  const timeZone = getTimeZone(deps)
  const instances: EventInstance[] = []
  for (const row of rows) {
    const event = toEvent(row, participants.get(row.id) ?? [])
    for (const occ of expandOccurrences(row, from, to, timeZone)) {
      instances.push({
        ...event,
        key: `${row.id}:${occ.occurrenceAt}`,
        occurrenceAt: occ.occurrenceAt,
        startAt: occ.startAt,
        endAt: occ.endAt,
        seriesStartAt: row.startAt,
        seriesEndAt: row.endAt,
      })
    }
  }
  return instances.sort((a, b) => a.startAt - b.startAt || Number(b.allDay) - Number(a.allDay))
}

function loadRow(deps: Deps, id: string): EventRow {
  const row = deps.db.select().from(events).where(eq(events.id, id)).get()
  if (!row) throw notFound('日程不存在')
  return row
}

export function getEvent(deps: Deps, viewer: Viewer, id: string): CalendarEvent {
  const row = loadRow(deps, id)
  const participantIds = participantsOf(deps, [id]).get(id) ?? []
  if (!canView(row, viewer, participantIds)) throw notFound('日程不存在')
  return toEvent(row, participantIds)
}

function validParticipants(deps: Deps, ids: readonly string[]): string[] {
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

function setParticipants(deps: Deps, eventId: string, ids: string[], ts: number): void {
  deps.db.delete(eventParticipants).where(eq(eventParticipants.eventId, eventId)).run()
  if (ids.length === 0) return
  deps.db
    .insert(eventParticipants)
    .values(ids.map((userId) => ({ eventId, userId, createdAt: ts, updatedAt: ts })))
    .run()
}

function broadcastChange(
  deps: Deps,
  rows: Array<{ row: EventRow; participantIds: string[] }>,
): void {
  const sent = new Set<string>()
  for (const { row, participantIds } of rows) {
    const audience = audienceFor(row, participantIds)
    const key = JSON.stringify(audience)
    if (sent.has(key)) continue
    sent.add(key)
    deps.hub.broadcast('calendar.changed', {}, audience)
  }
}

function insertEvent(deps: Deps, row: EventRow, participantIds: string[]): void {
  deps.db.insert(events).values(row).run()
  setParticipants(deps, row.id, participantIds, row.createdAt)
}

export function createEvent(deps: Deps, user: UserRow, input: EventInput): CalendarEvent {
  const ts = deps.now()
  const participantIds = validParticipants(deps, input.participantIds)
  const row: EventRow = {
    id: newId(),
    ownerId: user.id,
    visibility: input.visibility,
    title: input.title,
    location: input.location ?? null,
    note: input.note ?? null,
    color: input.color ?? null,
    startAt: input.startAt,
    endAt: input.endAt,
    allDay: input.allDay,
    rrule: input.rrule ?? null,
    exdates: [],
    parentId: null,
    recurrenceId: null,
    remindOffsets: [...new Set(input.remindOffsets)].sort((a, b) => a - b),
    createdAt: ts,
    updatedAt: ts,
  }
  insertEvent(deps, row, participantIds)
  regenerateReminders(deps, 'event', row.id)
  broadcastChange(deps, [{ row, participantIds }])
  return toEvent(row, participantIds)
}

function editable(
  deps: Deps,
  user: UserRow,
  id: string,
): { row: EventRow; participantIds: string[] } {
  const row = loadRow(deps, id)
  const participantIds = participantsOf(deps, [id]).get(id) ?? []
  const viewer: Viewer = { kind: 'user', userId: user.id }
  if (!canView(row, viewer, participantIds)) throw notFound('日程不存在')
  if (!canEdit(row, viewer) && !participantIds.includes(user.id))
    throw forbidden('只有创建者可以修改私有日程')
  return { row, participantIds }
}

function applyPatch(row: EventRow, patch: EventPatch): Partial<EventRow> {
  const next: Partial<EventRow> = {}
  if (patch.title !== undefined) next.title = patch.title
  if (patch.location !== undefined) next.location = patch.location
  if (patch.note !== undefined) next.note = patch.note
  if (patch.color !== undefined) next.color = patch.color
  if (patch.startAt !== undefined) next.startAt = patch.startAt
  if (patch.endAt !== undefined) next.endAt = patch.endAt
  if (patch.allDay !== undefined) next.allDay = patch.allDay
  if (patch.rrule !== undefined) next.rrule = patch.rrule
  if (patch.visibility !== undefined) next.visibility = patch.visibility
  if (patch.remindOffsets !== undefined) {
    next.remindOffsets = [...new Set(patch.remindOffsets)].sort((a, b) => a - b)
  }
  const startAt = next.startAt ?? row.startAt
  const endAt = next.endAt ?? row.endAt
  if (endAt < startAt) throw badRequest('结束时间不能早于开始时间')
  return next
}

function overridesOf(deps: Deps, parentId: string): EventRow[] {
  return deps.db.select().from(events).where(eq(events.parentId, parentId)).all()
}

function deleteRows(deps: Deps, ids: string[]): void {
  if (ids.length === 0) return
  deps.db.delete(events).where(inArray(events.id, ids)).run()
  clearReminders(deps, 'event', ids)
}

export function updateEvent(
  deps: Deps,
  user: UserRow,
  id: string,
  scope: EditScope,
  occurrence: number | undefined,
  patch: EventPatch,
): CalendarEvent {
  const { row, participantIds } = editable(deps, user, id)
  const ts = deps.now()
  const nextParticipants =
    patch.participantIds !== undefined
      ? validParticipants(deps, patch.participantIds)
      : participantIds
  const isSeries = Boolean(row.rrule)
  const effectiveScope: EditScope =
    !isSeries || scope === 'all' || (scope === 'following' && (occurrence ?? 0) <= row.startAt)
      ? 'all'
      : scope
  if (effectiveScope !== 'all' && occurrence === undefined) throw badRequest('缺少要修改的日程实例')
  if (row.visibility !== (patch.visibility ?? row.visibility) && row.ownerId !== user.id) {
    throw forbidden('只有创建者可以修改日程的共享范围')
  }

  const result = deps.db.transaction(() => {
    if (effectiveScope === 'all') {
      const changes = applyPatch(row, patch)
      const shift = changes.startAt !== undefined && isSeries ? changes.startAt - row.startAt : 0
      if (shift !== 0) {
        // Moving a whole series moves its exceptions and overrides with it.
        changes.exdates = row.exdates.map((d) => d + shift)
        for (const o of overridesOf(deps, row.id)) {
          deps.db
            .update(events)
            .set({ recurrenceId: (o.recurrenceId ?? 0) + shift, updatedAt: ts })
            .where(eq(events.id, o.id))
            .run()
        }
      }
      if (isSeries && changes.rrule === null) {
        deleteRows(
          deps,
          overridesOf(deps, row.id).map((o) => o.id),
        )
        changes.exdates = []
      }
      deps.db
        .update(events)
        .set({ ...changes, updatedAt: ts })
        .where(eq(events.id, id))
        .run()
      if (patch.participantIds !== undefined) setParticipants(deps, id, nextParticipants, ts)
      return { row: loadRow(deps, id), participantIds: nextParticipants }
    }

    const occ = occurrence as number
    const duration = row.endAt - row.startAt
    if (effectiveScope === 'this') {
      const changes = applyPatch(
        { ...row, startAt: occ, endAt: occ + duration },
        { ...patch, rrule: null },
      )
      const override: EventRow = {
        ...row,
        id: newId(),
        startAt: occ,
        endAt: occ + duration,
        ...changes,
        rrule: null,
        exdates: [],
        parentId: row.id,
        recurrenceId: occ,
        createdAt: ts,
        updatedAt: ts,
      }
      insertEvent(deps, override, nextParticipants)
      deps.db
        .update(events)
        .set({ exdates: [...new Set([...row.exdates, occ])], updatedAt: ts })
        .where(eq(events.id, row.id))
        .run()
      return { row: override, participantIds: nextParticipants }
    }

    // "This and following": end the current series before `occ` and start a new one from it.
    const timeZone = getTimeZone(deps)
    const changes = applyPatch({ ...row, startAt: occ, endAt: occ + duration }, patch)
    const newStart = changes.startAt ?? occ
    const shift = newStart - occ
    const rrule =
      changes.rrule !== undefined ? changes.rrule : row.rrule ? stripLimits(row.rrule) : null
    const successor: EventRow = {
      ...row,
      id: newId(),
      startAt: occ,
      endAt: occ + duration,
      ...changes,
      rrule,
      exdates: row.exdates.filter((d) => d >= occ).map((d) => d + shift),
      parentId: null,
      recurrenceId: null,
      createdAt: ts,
      updatedAt: ts,
    }
    insertEvent(deps, successor, nextParticipants)
    for (const o of overridesOf(deps, row.id)) {
      if ((o.recurrenceId ?? 0) >= occ) {
        deps.db
          .update(events)
          .set({
            parentId: successor.id,
            recurrenceId: (o.recurrenceId ?? 0) + shift,
            updatedAt: ts,
          })
          .where(eq(events.id, o.id))
          .run()
      }
    }
    const truncated = truncateRrule(row.rrule as string, occ, timeZone)
    const remaining = { ...row, rrule: truncated }
    if (hasOccurrences(remaining, timeZone)) {
      deps.db
        .update(events)
        .set({ rrule: truncated, exdates: row.exdates.filter((d) => d < occ), updatedAt: ts })
        .where(eq(events.id, row.id))
        .run()
    } else {
      deleteRows(deps, [row.id])
    }
    return { row: successor, participantIds: nextParticipants }
  })

  // Reminder regeneration runs its own transaction, so it must happen after the one above commits.
  regenerateReminders(deps, 'event', row.id)
  if (result.row.id !== row.id) regenerateReminders(deps, 'event', result.row.id)
  broadcastChange(deps, [{ row, participantIds }, result])
  return toEvent(result.row, result.participantIds)
}

export function deleteEvent(
  deps: Deps,
  user: UserRow,
  id: string,
  scope: EditScope,
  occurrence: number | undefined,
): void {
  const { row, participantIds } = editable(deps, user, id)
  const ts = deps.now()
  const isSeries = Boolean(row.rrule)
  const effectiveScope: EditScope =
    !isSeries || scope === 'all' || (scope === 'following' && (occurrence ?? 0) <= row.startAt)
      ? 'all'
      : scope
  if (effectiveScope !== 'all' && occurrence === undefined) throw badRequest('缺少要删除的日程实例')

  deps.db.transaction(() => {
    if (effectiveScope === 'all') {
      deleteRows(deps, [row.id, ...overridesOf(deps, row.id).map((o) => o.id)])
      return
    }
    const occ = occurrence as number
    if (effectiveScope === 'this') {
      deps.db
        .update(events)
        .set({ exdates: [...new Set([...row.exdates, occ])], updatedAt: ts })
        .where(eq(events.id, row.id))
        .run()
      return
    }
    const timeZone = getTimeZone(deps)
    deleteRows(
      deps,
      overridesOf(deps, row.id)
        .filter((o) => (o.recurrenceId ?? 0) >= occ)
        .map((o) => o.id),
    )
    const truncated = truncateRrule(row.rrule as string, occ, timeZone)
    deps.db
      .update(events)
      .set({ rrule: truncated, exdates: row.exdates.filter((d) => d < occ), updatedAt: ts })
      .where(eq(events.id, row.id))
      .run()
  })
  if (effectiveScope !== 'all') regenerateReminders(deps, 'event', row.id)
  broadcastChange(deps, [{ row, participantIds }])
}
