import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { getZonedParts } from '@shared/time'
import { sql } from 'drizzle-orm'
import * as schema from '../db/schema'
import { env } from '../env'
import type { Deps } from '../lib/context'
import { badRequest, notFound } from '../lib/errors'
import { getTimeZone } from './settings'

const KEEP = 7
const NAME_PATTERN = /^app-\d{8}-\d{6}\.db$/

export type BackupFile = { name: string; size: number; createdAt: number }

function backupName(now: number, timeZone: string): string {
  const p = getZonedParts(now, timeZone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `app-${p.year}${pad(p.month)}${pad(p.day)}-${pad(p.hour)}${pad(p.minute)}${pad(p.second)}.db`
}

export function listBackups(dir = env.backupsDir): BackupFile[] {
  mkdirSync(dir, { recursive: true })
  return readdirSync(dir)
    .filter((name) => NAME_PATTERN.test(name))
    .map((name) => {
      const stat = statSync(join(dir, name))
      return { name, size: stat.size, createdAt: stat.mtimeMs }
    })
    .sort((a, b) => b.createdAt - a.createdAt)
}

/** Writes a consistent snapshot with VACUUM INTO (safe while the app keeps running) and prunes old ones. */
export function runBackup(deps: Deps, dir = env.backupsDir): BackupFile {
  mkdirSync(dir, { recursive: true })
  const name = backupName(deps.now(), getTimeZone(deps))
  const path = join(dir, name)
  deps.db.run(sql.raw(`VACUUM INTO '${path.replaceAll("'", "''")}'`))
  for (const old of listBackups(dir).slice(KEEP)) unlinkSync(join(dir, old.name))
  const stat = statSync(path)
  return { name, size: stat.size, createdAt: stat.mtimeMs }
}

export function backupFilePath(name: string, dir = env.backupsDir): string {
  if (!NAME_PATTERN.test(name)) throw badRequest('备份文件名不合法')
  const path = join(dir, name)
  try {
    statSync(path)
  } catch {
    throw notFound('备份不存在')
  }
  return path
}

/** Full data export for portability; credentials and tokens are omitted. */
export function exportData(deps: Deps): Record<string, unknown> {
  const { db } = deps
  return {
    exportedAt: new Date(deps.now()).toISOString(),
    users: db
      .select()
      .from(schema.users)
      .all()
      .map(({ passwordHash: _omit, ...rest }) => rest),
    settings: db.select().from(schema.settings).all(),
    events: db.select().from(schema.events).all(),
    eventParticipants: db.select().from(schema.eventParticipants).all(),
    todos: db.select().from(schema.todos).all(),
    shoppingLists: db.select().from(schema.shoppingLists).all(),
    shoppingItems: db.select().from(schema.shoppingItems).all(),
    shoppingHistory: db.select().from(schema.shoppingHistory).all(),
    dashboards: db.select().from(schema.dashboards).all(),
    widgets: db.select().from(schema.widgets).all(),
  }
}
