import type { Context } from 'hono'
import { env } from '../env'

type AddressResolver = { requestIP: (request: Request) => { address: string } | null }

function isAddressResolver(value: unknown): value is AddressResolver {
  return (
    typeof value === 'object' &&
    value !== null &&
    'requestIP' in value &&
    typeof value.requestIP === 'function'
  )
}

function normalizeIp(address: string): string {
  return address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address
}

/** The TCP peer address; Bun passes its server as the Hono env. */
function peerAddress(c: Context): string | null {
  const server: unknown = c.env
  if (!isAddressResolver(server)) return null
  const info = server.requestIP(c.req.raw)
  return info ? normalizeIp(info.address) : null
}

/**
 * Identifies the client for rate limiting. Forwarded headers are only honoured when the peer is a
 * configured proxy: on direct access anyone can send them to dodge the limiter or lock others out.
 */
export function clientKey(
  c: Context,
  trustedProxies: ReadonlySet<string> = env.trustedProxies,
): string {
  const peer = peerAddress(c)
  if (!peer) return 'direct'
  if (!trustedProxies.has(peer)) return peer
  const hops = (c.req.header('x-forwarded-for') ?? '')
    .split(',')
    .map((hop) => normalizeIp(hop.trim()))
    .filter(Boolean)
  // Proxies append to the right; anything left of the nearest untrusted hop may be forged.
  for (let i = hops.length - 1; i >= 0; i--) {
    const hop = hops[i]
    if (hop && !trustedProxies.has(hop)) return hop
  }
  return c.req.header('x-real-ip')?.trim() || peer
}
