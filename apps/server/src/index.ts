import { existsSync, mkdirSync } from 'node:fs'
import { createApp } from './app'
import { openDatabase, runMigrations } from './db/client'
import { pendingMigrationCount } from './db/pending'
import { env } from './env'
import { startJobs } from './jobs/scheduler'
import type { Deps } from './lib/context'
import { RealtimeHub } from './realtime/hub'
import { runBackup } from './services/backup'

mkdirSync(env.uploadsDir, { recursive: true })
mkdirSync(env.backupsDir, { recursive: true })

const isExistingDb = existsSync(env.dbPath)
const { db, sqlite } = openDatabase(env.dbPath)
const deps: Deps = { db, hub: new RealtimeHub(), now: () => Date.now() }

if (isExistingDb && pendingMigrationCount(sqlite) > 0) {
  const backup = runBackup(deps)
  console.log(`升级前已备份数据库：${backup.name}`)
}
runMigrations(db)

const app = createApp(deps, { serveWeb: env.isProd })
startJobs(deps)

const server = Bun.serve({
  port: env.port,
  fetch: app.fetch,
  // Bun closes idle connections after 10s by default, which would drop SSE between heartbeats.
  idleTimeout: 120,
})

console.log(`家庭看板已启动：http://localhost:${server.port}`)
