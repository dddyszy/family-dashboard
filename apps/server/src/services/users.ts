import { MEMBER_COLORS } from '@shared/constants'
import {
  type CreateUserInput,
  DEFAULT_USER_PREFS,
  type Me,
  type PublicUser,
  type UpdateMeInput,
  type UpdateUserInput,
} from '@shared/schemas/users'
import { and, asc, count, eq, ne } from 'drizzle-orm'
import { sessions, users } from '../db/schema'
import type { Deps, UserRow } from '../lib/context'
import { newId, sha256 } from '../lib/crypto'
import { badRequest, conflict, notFound } from '../lib/errors'

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    avatar: row.avatar,
    color: row.color,
    role: row.role,
  }
}

export function toMe(row: UserRow): Me {
  return { ...toPublicUser(row), prefs: { ...DEFAULT_USER_PREFS, ...row.prefs } }
}

export function countUsers({ db }: Deps): number {
  return db.select({ n: count() }).from(users).get()?.n ?? 0
}

export function listUsers({ db }: Deps): PublicUser[] {
  return db.select().from(users).orderBy(asc(users.createdAt)).all().map(toPublicUser)
}

export function listUserIds({ db }: Deps): string[] {
  return db
    .select({ id: users.id })
    .from(users)
    .all()
    .map((r) => r.id)
}

export function getUser({ db }: Deps, id: string): UserRow {
  const row = db.select().from(users).where(eq(users.id, id)).get()
  if (!row) throw notFound('成员不存在')
  return row
}

export async function createUser(deps: Deps, input: CreateUserInput): Promise<UserRow> {
  const passwordHash = await Bun.password.hash(input.password)
  return insertUser(deps, input, passwordHash)
}

export function insertUser(deps: Deps, input: CreateUserInput, passwordHash: string): UserRow {
  const { db, now } = deps
  const existing = db.select().from(users).where(eq(users.username, input.username)).get()
  if (existing) throw conflict('用户名已被使用')
  const total = countUsers(deps)
  const ts = now()
  const row: UserRow = {
    id: newId(),
    username: input.username,
    name: input.name,
    avatar: null,
    color: input.color ?? MEMBER_COLORS[total % MEMBER_COLORS.length] ?? '#0a84ff',
    role: input.role,
    passwordHash,
    prefs: {},
    createdAt: ts,
    updatedAt: ts,
  }
  db.insert(users).values(row).run()
  return row
}

function assertKeepsAnAdmin(deps: Deps, target: UserRow): void {
  if (target.role !== 'admin') return
  const admins = deps.db.select().from(users).where(eq(users.role, 'admin')).all()
  if (admins.length <= 1) throw badRequest('至少需要保留一名管理员')
}

export async function updateUser(deps: Deps, id: string, input: UpdateUserInput): Promise<UserRow> {
  getUser(deps, id)
  const patch: Partial<UserRow> = { updatedAt: deps.now() }
  if (input.name !== undefined) patch.name = input.name
  if (input.color !== undefined) patch.color = input.color
  if (input.avatar !== undefined) patch.avatar = input.avatar
  if (input.role !== undefined) patch.role = input.role
  if (input.password !== undefined) {
    patch.passwordHash = await Bun.password.hash(input.password)
  }
  // Password hashing yields: validate the current admin count immediately before writing.
  const target = getUser(deps, id)
  if (input.role === 'member') assertKeepsAnAdmin(deps, target)
  if (input.password !== undefined) {
    deps.db.delete(sessions).where(eq(sessions.userId, id)).run()
  }
  deps.db.update(users).set(patch).where(eq(users.id, id)).run()
  if (input.password !== undefined) deps.hub.disconnect({ userId: id })
  return getUser(deps, id)
}

export function deleteUser(deps: Deps, id: string, actingUserId: string): void {
  if (id === actingUserId) throw badRequest('不能删除自己')
  const target = getUser(deps, id)
  assertKeepsAnAdmin(deps, target)
  deps.db.delete(users).where(eq(users.id, id)).run()
  deps.hub.disconnect({ userId: id })
}

export async function updateMe(
  deps: Deps,
  user: UserRow,
  input: UpdateMeInput,
  currentSessionToken?: string,
): Promise<UserRow> {
  const patch: Partial<UserRow> = { updatedAt: deps.now() }
  if (input.name !== undefined) patch.name = input.name
  if (input.color !== undefined) patch.color = input.color
  if (input.avatar !== undefined) patch.avatar = input.avatar
  if (input.prefs) patch.prefs = { ...user.prefs, ...input.prefs }
  if (input.newPassword) {
    const ok = input.currentPassword
      ? await Bun.password.verify(input.currentPassword, user.passwordHash)
      : false
    if (!ok) throw badRequest('当前密码不正确')
    patch.passwordHash = await Bun.password.hash(input.newPassword)
    if (getUser(deps, user.id).passwordHash !== user.passwordHash) {
      throw badRequest('密码已变更，请重新登录后再试')
    }
    deps.db
      .delete(sessions)
      .where(
        and(
          eq(sessions.userId, user.id),
          currentSessionToken ? ne(sessions.tokenHash, sha256(currentSessionToken)) : undefined,
        ),
      )
      .run()
  }
  deps.db.update(users).set(patch).where(eq(users.id, user.id)).run()
  if (input.newPassword) deps.hub.disconnect({ userId: user.id })
  return getUser(deps, user.id)
}
