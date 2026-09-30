import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestDeps, seedUser } from '../test-utils'
import { backupFilePath, listBackups, runBackup } from './backup'

test('backups in the same second capture each state instead of reusing a stale snapshot', async () => {
  const deps = createTestDeps()
  const dir = mkdtempSync(join(tmpdir(), 'family-backup-test-'))
  try {
    await seedUser(deps, 'first')
    const first = runBackup(deps, dir)
    await seedUser(deps, 'second')
    const second = runBackup(deps, dir)
    expect(second.name).not.toBe(first.name)
    expect(listBackups(dir)).toHaveLength(2)
    const snapshot = new Database(backupFilePath(second.name, dir), { readonly: true })
    try {
      expect(snapshot.query('select count(*) as count from users').get()).toEqual({ count: 2 })
    } finally {
      snapshot.close()
    }
    for (let i = 0; i < 8; i++) runBackup(deps, dir)
    expect(listBackups(dir)).toHaveLength(7)
    expect(() => backupFilePath('../app.db', dir)).toThrow()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
