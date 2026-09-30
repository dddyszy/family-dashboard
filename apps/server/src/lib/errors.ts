import type { ContentfulStatusCode } from 'hono/utils/http-status'

export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: ContentfulStatusCode = 400,
  ) {
    super(message)
  }
}

export const badRequest = (message: string) => new AppError('BAD_REQUEST', message, 400)
export const unauthorized = (message = '请先登录') => new AppError('UNAUTHORIZED', message, 401)
export const forbidden = (message = '没有权限执行此操作') => new AppError('FORBIDDEN', message, 403)
export const notFound = (message = '资源不存在') => new AppError('NOT_FOUND', message, 404)
export const conflict = (message: string) => new AppError('CONFLICT', message, 409)
export const tooManyRequests = (message = '操作过于频繁，请稍后再试') =>
  new AppError('TOO_MANY_REQUESTS', message, 429)
