import { join, resolve } from 'node:path'

const isProd = process.env.NODE_ENV === 'production'
const dataDir = resolve(process.env.DATA_DIR ?? join(import.meta.dir, '../../../data'))

const DEV_SECRET = 'dev-only-secret-do-not-use-in-production-000000'

function readSecret(): string {
  const secret = process.env.APP_SECRET
  if (secret && secret.length >= 32) return secret
  if (isProd) throw new Error('APP_SECRET 未设置或长度不足 32 位')
  return DEV_SECRET
}

export const env = {
  isProd,
  port: Number(process.env.PORT ?? 8080),
  dataDir,
  dbPath: join(dataDir, 'app.db'),
  uploadsDir: join(dataDir, 'uploads'),
  backupsDir: join(dataDir, 'backups'),
  appSecret: readSecret(),
  publicUrl: (process.env.PUBLIC_URL ?? '').replace(/\/$/, ''),
  webDist: resolve(process.env.WEB_DIST ?? join(import.meta.dir, '../../web/dist')),
}
