import type { LoginInput, SetupInput } from '@shared/schemas/users'
import { eq, lt } from 'drizzle-orm'
import { sessions, users } from '../db/schema'
import type { Deps, UserRow } from '../lib/context'
import { newId, randomToken, sha256 } from '../lib/crypto'
import { badRequest, conflict } from '../lib/errors'
import { countUsers, createUser } from './users'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000

export type IssuedSession = { token: string; user: UserRow }

function issueSession(deps: Deps, user: UserRow, userAgent: string | null): IssuedSession {
  const token = randomToken()
  const ts = deps.now()
  deps.db
    .insert(sessions)
    .values({
      id: newId(),
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: ts + SESSION_TTL_MS,
      userAgent: userAgent?.slice(0, 200) ?? null,
      createdAt: ts,
      updatedAt: ts,
    })
    .run()
  return { token, user }
}

export async function setupAdmin(
  deps: Deps,
  input: SetupInput,
  userAgent: string | null,
): Promise<IssuedSession> {
  if (countUsers(deps) > 0) throw conflict('系统已经初始化')
  const user = await createUser(deps, { ...input, role: 'admin' })
  return issueSession(deps, user, userAgent)
}

export async function login(
  deps: Deps,
  input: LoginInput,
  userAgent: string | null,
): Promise<IssuedSession> {
  const user = deps.db.select().from(users).where(eq(users.username, input.username)).get()
  const ok = user ? await Bun.password.verify(input.password, user.passwordHash) : false
  if (!user || !ok) throw badRequest('用户名或密码不正确')
  return issueSession(deps, user, userAgent)
}

export function logout(deps: Deps, token: string): void {
  deps.db
    .delete(sessions)
    .where(eq(sessions.tokenHash, sha256(token)))
    .run()
}

/** Returns the session's user and slides the expiry forward at most once a day. */
export function resolveSession(deps: Deps, token: string): UserRow | null {
  const row = deps.db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, sha256(token)))
    .get()
  if (!row) return null
  const ts = deps.now()
  if (row.session.expiresAt <= ts) {
    deps.db.delete(sessions).where(eq(sessions.id, row.session.id)).run()
    return null
  }
  if (ts - row.session.updatedAt > RENEW_AFTER_MS) {
    deps.db
      .update(sessions)
      .set({ expiresAt: ts + SESSION_TTL_MS, updatedAt: ts })
      .where(eq(sessions.id, row.session.id))
      .run()
  }
  return row.user
}

export function purgeExpiredSessions(deps: Deps): void {
  deps.db.delete(sessions).where(lt(sessions.expiresAt, deps.now())).run()
}
