import { z } from 'zod'
import { VISIBILITIES } from '../constants'
import { rruleProblem } from '../recurrence'

export const idSchema = z.string().min(1).max(64)
export const visibilitySchema = z.enum(VISIBILITIES)
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, '颜色格式应为 #RRGGBB')
export const timestampSchema = z.number().int().nonnegative()
export const hmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '时间格式应为 HH:mm')

export const remindOffsetsSchema = z
  .array(
    z
      .number()
      .int()
      .min(0)
      .max(60 * 24 * 30),
  )
  .max(10, '最多设置 10 个提醒')

export const rruleSchema = z
  .string()
  .max(300)
  .regex(/^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Z0-9,+-]+)*$/, '重复规则格式不正确')
  .superRefine((value, ctx) => {
    const problem = rruleProblem(value)
    if (problem) ctx.addIssue({ code: 'custom', message: problem })
  })
