import type { LoginInput, RegisterInput, SetupInput } from '@shared/schemas/users'
import { eq, lt } from 'drizzle-orm'
import { sessions, users } from '../db/schema'
import type { Deps, UserRow } from '../lib/context'
import { newId, randomToken, sha256 } from '../lib/crypto'
import { badRequest, conflict, forbidden } from '../lib/errors'
import { getHousehold } from './settings'
import { countUsers, insertUser } from './users'

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
  return createAccount(deps, input, 'admin', userAgent)
}

export async function registerMember(
  deps: Deps,
  input: RegisterInput,
  userAgent: string | null,
): Promise<IssuedSession> {
  return createAccount(deps, input, 'member', userAgent)
}

async function createAccount(
  deps: Deps,
  input: RegisterInput,
  role: UserRow['role'],
  userAgent: string | null,
): Promise<IssuedSession> {
  const assertAllowed = () => {
    const initialized = countUsers(deps) > 0
    if (role === 'admin' && initialized) throw conflict('系统已经初始化')
    if (role === 'member' && !initialized) throw conflict('请先创建管理员账号')
    if (role === 'member' && !getHousehold(deps).allowRegistration) {
      throw forbidden('管理员未开放自助注册，请联系管理员为你添加账号')
    }
  }
  assertAllowed()
  const passwordHash = await Bun.password.hash(input.password)
  return deps.db.transaction(() => {
    // Hashing yields to other requests; recheck initialization before inserting any account.
    assertAllowed()
    const user = insertUser(deps, { ...input, role }, passwordHash)
    return issueSession(deps, user, userAgent)
  })
}

export async function login(
  deps: Deps,
  input: LoginInput,
  userAgent: string | null,
): Promise<IssuedSession> {
  const user = deps.db.select().from(users).where(eq(users.username, input.username)).get()
  const ok = user ? await Bun.password.verify(input.password, user.passwordHash) : false
  const current = user ? deps.db.select().from(users).where(eq(users.id, user.id)).get() : null
  // A password reset may finish while verification yields; never issue an old-password session.
  if (!user || !ok || !current || current.passwordHash !== user.passwordHash) {
    throw badRequest('用户名或密码不正确')
  }
  return issueSession(deps, current, userAgent)
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
