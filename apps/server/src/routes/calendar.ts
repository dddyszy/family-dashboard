import {
  eventInput,
  eventPatch,
  eventRangeQuery,
  eventScopeQuery,
  parseInput,
} from '@shared/schemas/calendar'
import { snoozeInput } from '@shared/schemas/reminders'
import { todoInput, todoListQuery, todoPatch } from '@shared/schemas/todos'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireUser, requireViewer } from '../lib/auth'
import type { AppEnv } from '../lib/context'
import { readJson, readQuery } from '../lib/validate'
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEventsInRange,
  updateEvent,
} from '../services/calendar'
import { parseQuickEntry } from '../services/quick-entry'
import { activeReminders, dismissReminder, snoozeReminder } from '../services/reminders'
import { getTimeZone } from '../services/settings'
import { createTodo, deleteTodo, listTodos, setTodoDone, updateTodo } from '../services/todos'
import { listUsers } from '../services/users'

export const calendarRoutes = new Hono<AppEnv>()
  .get('/events', (c) => {
    const { from, to } = readQuery(c, eventRangeQuery)
    return c.json(listEventsInRange(c.var.deps, requireViewer(c), from, to))
  })
  .get('/events/:id', (c) => c.json(getEvent(c.var.deps, requireViewer(c), c.req.param('id'))))
  .post('/events', async (c) => {
    const user = requireUser(c)
    const input = await readJson(c, eventInput)
    return c.json(createEvent(c.var.deps, user, input), 201)
  })
  .patch('/events/:id', async (c) => {
    const user = requireUser(c)
    const { scope, occurrence } = readQuery(c, eventScopeQuery)
    const patch = await readJson(c, eventPatch)
    return c.json(updateEvent(c.var.deps, user, c.req.param('id'), scope, occurrence, patch))
  })
  .delete('/events/:id', (c) => {
    const user = requireUser(c)
    const { scope, occurrence } = readQuery(c, eventScopeQuery)
    deleteEvent(c.var.deps, user, c.req.param('id'), scope, occurrence)
    return c.json({ ok: true })
  })
  .post('/parse', async (c) => {
    requireUser(c)
    const { text } = await readJson(c, parseInput)
    const deps = c.var.deps
    return c.json(parseQuickEntry(text, deps.now(), getTimeZone(deps), listUsers(deps)))
  })
  .get('/todos', (c) => {
    const { status } = readQuery(c, todoListQuery)
    return c.json(listTodos(c.var.deps, requireViewer(c), status))
  })
  .post('/todos', async (c) => {
    const user = requireUser(c)
    const input = await readJson(c, todoInput)
    return c.json(createTodo(c.var.deps, user, input), 201)
  })
  .patch('/todos/:id', async (c) => {
    const user = requireUser(c)
    const patch = await readJson(c, todoPatch)
    return c.json(updateTodo(c.var.deps, user, c.req.param('id'), patch))
  })
  .delete('/todos/:id', (c) => {
    const user = requireUser(c)
    deleteTodo(c.var.deps, user, c.req.param('id'))
    return c.json({ ok: true })
  })
  .post('/todos/:id/done', async (c) => {
    const user = requireUser(c)
    const { done } = await readJson(c, z.object({ done: z.boolean().default(true) }))
    return c.json(setTodoDone(c.var.deps, user, c.req.param('id'), done))
  })
  .get('/reminders/active', (c) => {
    const actor = c.var.actor
    if (actor?.kind !== 'user') return c.json([])
    return c.json(activeReminders(c.var.deps, actor.user.id))
  })
  .post('/reminders/:id/dismiss', (c) => {
    const user = requireUser(c)
    dismissReminder(c.var.deps, user, c.req.param('id'))
    return c.json({ ok: true })
  })
  .post('/reminders/:id/snooze', async (c) => {
    const user = requireUser(c)
    const { minutes } = await readJson(c, snoozeInput)
    return c.json(snoozeReminder(c.var.deps, user, c.req.param('id'), minutes))
  })
