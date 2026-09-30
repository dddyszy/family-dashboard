import { join } from 'node:path'
import { Hono } from 'hono'
import { env } from '../env'
import { requireUser } from '../lib/auth'
import type { AppEnv } from '../lib/context'
import { newId } from '../lib/crypto'
import { badRequest } from '../lib/errors'

const MAX_BYTES = 5 * 1024 * 1024
const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export const uploadRoutes = new Hono<AppEnv>().post('/uploads', async (c) => {
  requireUser(c)
  const body = await c.req.parseBody()
  const file = body.file
  if (!(file instanceof File)) throw badRequest('请选择要上传的图片')
  const ext = EXTENSIONS[file.type]
  if (!ext) throw badRequest('只支持 PNG、JPEG、WebP 或 GIF 图片')
  if (file.size > MAX_BYTES) throw badRequest('图片不能超过 5MB')
  const name = `${newId()}.${ext}`
  await Bun.write(join(env.uploadsDir, name), file)
  return c.json({ url: `/uploads/${name}` }, 201)
})
