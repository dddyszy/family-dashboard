import { Hono } from 'hono'
import { requireAdmin } from '../lib/auth'
import type { AppEnv } from '../lib/context'
import { backupFilePath, exportData, listBackups, runBackup } from '../services/backup'

export const backupRoutes = new Hono<AppEnv>()
  .get('/backups', (c) => {
    requireAdmin(c)
    return c.json(listBackups())
  })
  .post('/backups', (c) => {
    requireAdmin(c)
    return c.json(runBackup(c.var.deps), 201)
  })
  .get('/backups/:name', (c) => {
    requireAdmin(c)
    const name = c.req.param('name')
    const file = Bun.file(backupFilePath(name))
    return new Response(file, {
      headers: {
        'content-type': 'application/vnd.sqlite3',
        'content-disposition': `attachment; filename="${name}"`,
      },
    })
  })
  .get('/export', (c) => {
    requireAdmin(c)
    const date = new Date(c.var.deps.now()).toISOString().slice(0, 10)
    c.header('content-disposition', `attachment; filename="family-dashboard-${date}.json"`)
    return c.json(exportData(c.var.deps))
  })
