import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { requireViewer } from '../lib/auth'
import type { AppEnv } from '../lib/context'

const HEARTBEAT_MS = 20_000

export const streamRoutes = new Hono<AppEnv>().get('/stream', (c) => {
  const viewer = requireViewer(c)
  // nginx (and therefore Synology's reverse proxy) buffers responses unless told otherwise.
  c.header('X-Accel-Buffering', 'no')
  c.header('Cache-Control', 'no-cache, no-transform')
  return streamSSE(c, async (stream) => {
    const remove = c.var.deps.hub.add(viewer, (event, data) => {
      void stream.writeSSE({ event, data })
    })
    stream.onAbort(remove)
    await stream.writeSSE({ event: 'ready', data: '{}' })
    while (!stream.aborted && !stream.closed) {
      await stream.sleep(HEARTBEAT_MS)
      await stream.write(': ping\n\n')
    }
    remove()
  })
})
