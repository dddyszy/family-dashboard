import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { clientKey } from './request'

const TRUSTED = new Set(['10.0.0.1', '10.0.0.2'])
const app = new Hono().get('/', (c) => c.text(clientKey(c, TRUSTED)))

async function keyFor(peer: string | null, headers: Record<string, string> = {}): Promise<string> {
  const server = peer ? { requestIP: () => ({ address: peer }) } : undefined
  return (await app.request('/', { headers }, server)).text()
}

describe('clientKey', () => {
  test('falls back to a shared key when the socket address is unknown', async () => {
    expect(await keyFor(null, { 'x-forwarded-for': '203.0.113.5' })).toBe('direct')
  })

  test('uses the socket address and ignores forwarding headers from untrusted peers', async () => {
    const forged = { 'x-forwarded-for': '203.0.113.5', 'x-real-ip': '203.0.113.6' }
    expect(await keyFor('192.168.1.20', forged)).toBe('192.168.1.20')
    expect(await keyFor('::ffff:192.168.1.20')).toBe('192.168.1.20')
  })

  test('takes the nearest untrusted hop behind trusted proxies', async () => {
    const headers = { 'x-forwarded-for': '198.51.100.1, 203.0.113.5, 10.0.0.2' }
    expect(await keyFor('10.0.0.1', headers)).toBe('203.0.113.5')
    expect(await keyFor('10.0.0.1', { 'x-real-ip': '203.0.113.7' })).toBe('203.0.113.7')
    expect(await keyFor('10.0.0.1')).toBe('10.0.0.1')
  })
})
