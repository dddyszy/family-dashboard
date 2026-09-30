import type { Context } from 'hono'
import type { z } from 'zod'
import { AppError } from './errors'

function toAppError(error: z.ZodError): AppError {
  const issue = error.issues[0]
  const path = issue?.path.length ? `（${issue.path.join('.')}）` : ''
  return new AppError('VALIDATION', `${issue?.message ?? '参数不正确'}${path}`, 400)
}

export function parseWith<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value)
  if (!result.success) throw toAppError(result.error)
  return result.data
}

export async function readJson<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new AppError('VALIDATION', '请求体不是合法的 JSON', 400)
  }
  return parseWith(schema, body)
}

export function readQuery<S extends z.ZodType>(c: Context, schema: S): z.output<S> {
  return parseWith(schema, c.req.query())
}
