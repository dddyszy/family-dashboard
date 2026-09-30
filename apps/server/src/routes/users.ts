import { createUserInput, updateUserInput } from '@shared/schemas/users'
import { Hono } from 'hono'
import { requireActor, requireAdmin } from '../lib/auth'
import type { AppEnv } from '../lib/context'
import { readJson } from '../lib/validate'
import { createUser, deleteUser, listUsers, toPublicUser, updateUser } from '../services/users'

export const userRoutes = new Hono<AppEnv>()
  .get('/users', (c) => {
    requireActor(c)
    return c.json(listUsers(c.var.deps))
  })
  .post('/users', async (c) => {
    requireAdmin(c)
    const input = await readJson(c, createUserInput)
    const user = await createUser(c.var.deps, input)
    c.var.deps.hub.broadcast('members.changed', {}, { kind: 'family' })
    return c.json(toPublicUser(user), 201)
  })
  .patch('/users/:id', async (c) => {
    requireAdmin(c)
    const input = await readJson(c, updateUserInput)
    const user = await updateUser(c.var.deps, c.req.param('id'), input)
    c.var.deps.hub.broadcast('members.changed', {}, { kind: 'family' })
    return c.json(toPublicUser(user))
  })
  .delete('/users/:id', (c) => {
    const admin = requireAdmin(c)
    deleteUser(c.var.deps, c.req.param('id'), admin.id)
    c.var.deps.hub.broadcast('members.changed', {}, { kind: 'family' })
    return c.json({ ok: true })
  })
