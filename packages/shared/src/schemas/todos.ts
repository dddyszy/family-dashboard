import { z } from 'zod'
import {
  idSchema,
  remindOffsetsSchema,
  rruleSchema,
  timestampSchema,
  visibilitySchema,
} from './common'

export type Todo = {
  id: string
  ownerId: string
  visibility: 'private' | 'family'
  title: string
  note: string | null
  dueAt: number | null
  rrule: string | null
  assigneeIds: string[]
  remindOffsets: number[]
  doneAt: number | null
  createdAt: number
  updatedAt: number
}

export const todoInput = z.object({
  title: z.string().trim().min(1, '请输入待办内容').max(100),
  note: z.string().trim().max(1000).nullable().optional(),
  dueAt: timestampSchema.nullable().optional(),
  rrule: rruleSchema.nullable().optional(),
  visibility: visibilitySchema.default('family'),
  assigneeIds: z.array(idSchema).max(20).default([]),
  remindOffsets: remindOffsetsSchema.default([]),
})
export type TodoInput = z.infer<typeof todoInput>

export const todoPatch = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  dueAt: timestampSchema.nullable().optional(),
  rrule: rruleSchema.nullable().optional(),
  visibility: visibilitySchema.optional(),
  assigneeIds: z.array(idSchema).max(20).optional(),
  remindOffsets: remindOffsetsSchema.optional(),
})
export type TodoPatch = z.infer<typeof todoPatch>

export const todoListQuery = z.object({ status: z.enum(['open', 'done']).default('open') })
