import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { isSameActor, requireActor, resolveActor } from '../lib/auth'
import { type AppEnv, viewerOf } from '../lib/context'

const HEARTBEAT_MS = 20_000

export const streamRoutes = new Hono<AppEnv>().get('/stream', (c) => {
  const actor = requireActor(c)
  const { hub } = c.var.deps
  // nginx (and therefore Synology's reverse proxy) buffers responses unless told otherwise.
  c.header('X-Accel-Buffering', 'no')
  c.header('Cache-Control', 'no-cache, no-transform')
  return streamSSE(c, async (stream) => {
    const remove = hub.add(
      viewerOf(actor),
      (event, data) => {
        void stream.writeSSE({ event, data })
      },
      {
        deviceId: actor.kind === 'device' ? actor.device.id : null,
        close: () => void stream.close(),
      },
    )
    stream.onAbort(remove)
    await stream.writeSSE({ event: 'ready', data: '{}' })
    while (!stream.aborted && !stream.closed) {
      await stream.sleep(HEARTBEAT_MS)
      // Logout, expiry and password resets don't notify the hub. Closing makes the browser
      // reconnect, which re-authenticates and gets 401 or a stream for the new identity.
      if (!isSameActor(resolveActor(c), actor)) break
      await stream.write(': ping\n\n')
    }
    remove()
  })
})
