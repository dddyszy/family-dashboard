import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { compress } from 'hono/compress'
import { env } from './env'
import './home/contributors'
import { authenticate, originGuard } from './lib/auth'
import type { AppEnv, Deps } from './lib/context'
import { AppError } from './lib/errors'
import { authRoutes } from './routes/auth'
import { backupRoutes } from './routes/backup'
import { calendarRoutes } from './routes/calendar'
import { dashboardRoutes } from './routes/dashboards'
import { deviceRoutes } from './routes/devices'
import { settingsRoutes } from './routes/settings'
import { shoppingRoutes } from './routes/shopping'
import { streamRoutes } from './routes/stream'
import { uploadRoutes } from './routes/uploads'
import { userRoutes } from './routes/users'

export type AppOptions = { serveWeb?: boolean }

export function createApp(deps: Deps, options: AppOptions = {}) {
  const api = new Hono<AppEnv>()
    .use(async (c, next) => {
      c.set('deps', deps)
      await next()
    })
    .use(originGuard)
    .use(authenticate)
    .get('/health', (c) => c.json({ ok: true, time: deps.now() }))
    .route('/', authRoutes)
    .route('/', userRoutes)
    .route('/', settingsRoutes)
    .route('/', deviceRoutes)
    .route('/', streamRoutes)
    .route('/', uploadRoutes)
    .route('/', dashboardRoutes)
    .route('/', shoppingRoutes)
    .route('/', calendarRoutes)
    .route('/', backupRoutes)

  api.onError((error, c) => {
    if (error instanceof AppError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status)
    }
    console.error(error)
    return c.json({ error: { code: 'INTERNAL', message: '服务器内部错误' } }, 500)
  })
  api.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: '接口不存在' } }, 404))

  const app = new Hono<AppEnv>()
  app.use('/api/*', async (c, next) => {
    // SSE must not be compressed or buffered.
    if (c.req.path === '/api/stream') return next()
    return compress()(c, next)
  })
  app.route('/api', api)
  app.use('/uploads/*', async (c, next) => {
    c.header('Cache-Control', 'public, max-age=604800')
    await next()
  })
  app.use('/uploads/*', serveStatic({ root: env.dataDir }))

  if (options.serveWeb && existsSync(join(env.webDist, 'index.html'))) {
    mountWeb(app)
  }
  return app
}

function mountWeb(app: Hono<AppEnv>): void {
  const root = env.webDist
  app.use('/assets/*', async (c, next) => {
    await next()
    c.header('Cache-Control', 'public, max-age=31536000, immutable')
  })
  app.use('*', async (c, next) => {
    await next()
    const path = c.req.path
    if (
      path === '/' ||
      path.endsWith('.html') ||
      path === '/sw.js' ||
      path.endsWith('.webmanifest')
    ) {
      c.header('Cache-Control', 'no-cache')
    }
  })
  app.use('*', serveStatic({ root }))
  app.get('*', serveStatic({ path: join(root, 'index.html') }))
}
