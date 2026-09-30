import type { Context } from 'hono'

export function clientKey(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'direct'
  )
}
