import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { type BunSQLiteDatabase, drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import * as schema from './schema'

export type Db = BunSQLiteDatabase<typeof schema>

export type DbHandle = { db: Db; sqlite: Database }

export const MIGRATIONS_DIR = join(import.meta.dir, 'migrations')

export function openDatabase(path: string): DbHandle {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const sqlite = new Database(path, { create: true, strict: true })
  sqlite.exec('PRAGMA journal_mode = WAL;')
  sqlite.exec('PRAGMA synchronous = NORMAL;')
  sqlite.exec('PRAGMA foreign_keys = ON;')
  sqlite.exec('PRAGMA busy_timeout = 5000;')
  const db = drizzle(sqlite, { schema })
  return { db, sqlite }
}

export function runMigrations(db: Db): void {
  migrate(db, { migrationsFolder: MIGRATIONS_DIR })
}

export function createTestDb(): Db {
  const { db } = openDatabase(':memory:')
  runMigrations(db)
  return db
}
