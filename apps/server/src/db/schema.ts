import type { Layouts, WidgetInstance } from '@shared/schemas/dashboard'
import type { ReminderPayload } from '@shared/schemas/reminders'
import type { UserPrefs } from '@shared/schemas/users'
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const timestamps = {
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  color: text('color').notNull(),
  role: text('role', { enum: ['admin', 'member'] }).notNull(),
  passwordHash: text('password_hash').notNull(),
  prefs: text('prefs', { mode: 'json' }).$type<Partial<UserPrefs>>().notNull().default({}),
  ...timestamps,
})

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: integer('expires_at').notNull(),
    userAgent: text('user_agent'),
    ...timestamps,
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  lastSeenAt: integer('last_seen_at'),
  revokedAt: integer('revoked_at'),
  ...timestamps,
})

export const pairingCodes = sqliteTable('pairing_codes', {
  code: text('code').primaryKey(),
  expiresAt: integer('expires_at').notNull(),
  ...timestamps,
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<unknown>().notNull(),
  ...timestamps,
})

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    visibility: text('visibility', { enum: ['private', 'family'] }).notNull(),
    title: text('title').notNull(),
    location: text('location'),
    note: text('note'),
    color: text('color'),
    startAt: integer('start_at').notNull(),
    endAt: integer('end_at').notNull(),
    allDay: integer('all_day', { mode: 'boolean' }).notNull().default(false),
    rrule: text('rrule'),
    exdates: text('exdates', { mode: 'json' }).$type<number[]>().notNull().default([]),
    parentId: text('parent_id'),
    recurrenceId: integer('recurrence_id'),
    remindOffsets: text('remind_offsets', { mode: 'json' }).$type<number[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => [index('events_start_idx').on(t.startAt), index('events_parent_idx').on(t.parentId)],
)

export const eventParticipants = sqliteTable(
  'event_participants',
  {
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.userId] }),
    index('participants_user_idx').on(t.userId),
  ],
)

export const todos = sqliteTable('todos', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  visibility: text('visibility', { enum: ['private', 'family'] }).notNull(),
  title: text('title').notNull(),
  note: text('note'),
  dueAt: integer('due_at'),
  rrule: text('rrule'),
  assigneeIds: text('assignee_ids', { mode: 'json' }).$type<string[]>().notNull().default([]),
  remindOffsets: text('remind_offsets', { mode: 'json' }).$type<number[]>().notNull().default([]),
  doneAt: integer('done_at'),
  ...timestamps,
})

export const shoppingLists = sqliteTable('shopping_lists', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  visibility: text('visibility', { enum: ['private', 'family'] }).notNull(),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  sort: integer('sort').notNull().default(0),
  ...timestamps,
})

export const shoppingItems = sqliteTable(
  'shopping_items',
  {
    id: text('id').primaryKey(),
    listId: text('list_id')
      .notNull()
      .references(() => shoppingLists.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    qty: real('qty'),
    unit: text('unit'),
    category: text('category').notNull(),
    note: text('note'),
    addedBy: text('added_by').notNull(),
    checked: integer('checked', { mode: 'boolean' }).notNull().default(false),
    checkedBy: text('checked_by'),
    checkedAt: integer('checked_at'),
    archivedAt: integer('archived_at'),
    ...timestamps,
  },
  (t) => [index('items_list_idx').on(t.listId, t.archivedAt)],
)

export const shoppingHistory = sqliteTable('shopping_history', {
  key: text('key').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  count: integer('count').notNull().default(0),
  lastAt: integer('last_at').notNull(),
  ...timestamps,
})

export const dashboards = sqliteTable('dashboards', {
  id: text('id').primaryKey(),
  layouts: text('layouts', { mode: 'json' }).$type<Layouts>().notNull(),
  ...timestamps,
})

export const widgets = sqliteTable(
  'widgets',
  {
    id: text('id').primaryKey(),
    dashboardId: text('dashboard_id')
      .notNull()
      .references(() => dashboards.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    config: text('config', { mode: 'json' })
      .$type<WidgetInstance['config']>()
      .notNull()
      .default({}),
    ...timestamps,
  },
  (t) => [index('widgets_dashboard_idx').on(t.dashboardId)],
)

export const reminders = sqliteTable(
  'reminders',
  {
    id: text('id').primaryKey(),
    sourceType: text('source_type', { enum: ['event', 'todo'] }).notNull(),
    sourceId: text('source_id').notNull(),
    occurrenceAt: integer('occurrence_at').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fireAt: integer('fire_at').notNull(),
    status: text('status', { enum: ['pending', 'fired', 'dismissed', 'expired'] }).notNull(),
    firedAt: integer('fired_at'),
    payload: text('payload', { mode: 'json' }).$type<ReminderPayload>().notNull(),
    ...timestamps,
  },
  (t) => [
    index('reminders_due_idx').on(t.status, t.fireAt),
    index('reminders_source_idx').on(t.sourceType, t.sourceId),
    index('reminders_user_idx').on(t.userId, t.status),
  ],
)
