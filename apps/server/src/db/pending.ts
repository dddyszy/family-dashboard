import type { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MIGRATIONS_DIR } from './client'

/** Number of bundled migrations not yet applied to this database file. */
export function pendingMigrationCount(sqlite: Database): number {
  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8'),
  ) as {
    entries: unknown[]
  }
  const table = sqlite
    .query("select name from sqlite_master where type = 'table' and name = '__drizzle_migrations'")
    .get()
  if (!table) return journal.entries.length
  const row = sqlite.query('select count(*) as n from __drizzle_migrations').get() as { n: number }
  return journal.entries.length - row.n
}
