import {
  addItemsInput,
  createListInput,
  updateItemInput,
  updateListInput,
} from '@shared/schemas/shopping'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireUser, requireViewer } from '../lib/auth'
import type { AppEnv } from '../lib/context'
import { readJson, readQuery } from '../lib/validate'
import {
  addItems,
  clearChecked,
  createList,
  deleteItem,
  deleteList,
  frequent,
  listItems,
  listLists,
  suggest,
  updateItem,
  updateList,
} from '../services/shopping'

export const shoppingRoutes = new Hono<AppEnv>()
  .get('/lists', (c) => c.json(listLists(c.var.deps, requireViewer(c))))
  .post('/lists', async (c) => {
    const user = requireUser(c)
    const input = await readJson(c, createListInput)
    return c.json(createList(c.var.deps, user, input), 201)
  })
  .patch('/lists/:id', async (c) => {
    const user = requireUser(c)
    const input = await readJson(c, updateListInput)
    return c.json(
      updateList(c.var.deps, { kind: 'user', userId: user.id }, c.req.param('id'), input),
    )
  })
  .delete('/lists/:id', (c) => {
    const user = requireUser(c)
    deleteList(c.var.deps, { kind: 'user', userId: user.id }, c.req.param('id'))
    return c.json({ ok: true })
  })
  .get('/lists/:id/items', (c) =>
    c.json(listItems(c.var.deps, requireViewer(c), c.req.param('id'))),
  )
  .post('/lists/:id/items', async (c) => {
    const user = requireUser(c)
    const input = await readJson(c, addItemsInput)
    const items = addItems(
      c.var.deps,
      user,
      c.req.param('id'),
      Array.isArray(input) ? input : [input],
    )
    return c.json(items, 201)
  })
  .post('/lists/:id/clear-checked', (c) => {
    const user = requireUser(c)
    return c.json({ cleared: clearChecked(c.var.deps, user, c.req.param('id')) })
  })
  .patch('/items/:id', async (c) => {
    const user = requireUser(c)
    const input = await readJson(c, updateItemInput)
    return c.json(updateItem(c.var.deps, user, c.req.param('id'), input))
  })
  .delete('/items/:id', (c) => {
    const user = requireUser(c)
    deleteItem(c.var.deps, user, c.req.param('id'))
    return c.json({ ok: true })
  })
  .get('/shopping/suggest', (c) => {
    requireUser(c)
    const { q } = readQuery(c, z.object({ q: z.string().max(50).default('') }))
    return c.json(suggest(c.var.deps, q))
  })
  .get('/shopping/frequent', (c) => {
    requireUser(c)
    return c.json(frequent(c.var.deps))
  })
