import { readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { ResetMode, ResetResult } from '@shared/schemas/admin'
import * as schema from '../db/schema'
import { env } from '../env'
import type { Deps, UserRow } from '../lib/context'
import { badRequest } from '../lib/errors'
import { runBackup } from './backup'
import { clearHouseholdCache } from './settings'

export type ResetOptions = {
  /** Where to write the safety backup; `null` skips it (tests). */
  backupDir?: string | null
  uploadsDir?: string | null
}

/**
 * Deletes family data after taking a backup. `content` keeps accounts, settings and paired
 * devices; `factory` wipes everything and returns the app to its first-run setup screen.
 */
export async function resetData(
  deps: Deps,
  admin: UserRow,
  mode: ResetMode,
  password: string,
  options: ResetOptions = {},
): Promise<ResetResult> {
  if (!(await Bun.password.verify(password, admin.passwordHash)))
    throw badRequest('管理员密码不正确')

  const backupDir = options.backupDir === undefined ? env.backupsDir : options.backupDir
  const backup = backupDir ? runBackup(deps, backupDir).name : null

  deps.db.transaction((tx) => {
    tx.delete(schema.reminders).run()
    tx.delete(schema.eventParticipants).run()
    tx.delete(schema.events).run()
    tx.delete(schema.todos).run()
    tx.delete(schema.shoppingItems).run()
    tx.delete(schema.shoppingLists).run()
    tx.delete(schema.shoppingHistory).run()
    tx.delete(schema.widgets).run()
    tx.delete(schema.dashboards).run()
    if (mode === 'factory') {
      tx.delete(schema.pairingCodes).run()
      tx.delete(schema.devices).run()
      tx.delete(schema.sessions).run()
      tx.delete(schema.settings).run()
      tx.delete(schema.users).run()
    }
  })

  if (mode === 'factory') {
    clearHouseholdCache(deps.db)
    const uploadsDir = options.uploadsDir === undefined ? env.uploadsDir : options.uploadsDir
    if (uploadsDir) clearDirectory(uploadsDir)
  }

  deps.hub.broadcast('data.reset', { mode }, { kind: 'family' })
  return { mode, backup }
}

function clearDirectory(dir: string): void {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return
  }
  for (const name of names) rmSync(join(dir, name), { recursive: true, force: true })
}
