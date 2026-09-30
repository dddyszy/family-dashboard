import { z } from 'zod'
import {
  colorSchema,
  idSchema,
  remindOffsetsSchema,
  rruleSchema,
  timestampSchema,
  visibilitySchema,
} from './common'

export type CalendarEvent = {
  id: string
  ownerId: string
  visibility: 'private' | 'family'
  title: string
  location: string | null
  note: string | null
  color: string | null
  startAt: number
  endAt: number
  allDay: boolean
  rrule: string | null
  exdates: number[]
  parentId: string | null
  recurrenceId: number | null
  remindOffsets: number[]
  participantIds: string[]
  createdAt: number
  updatedAt: number
}

/** One concrete occurrence. `startAt`/`endAt` are the occurrence times; `series*` the stored ones. */
export type EventInstance = CalendarEvent & {
  key: string
  occurrenceAt: number
  seriesStartAt: number
  seriesEndAt: number
}

export const editScopeSchema = z.enum(['this', 'following', 'all'])
export type EditScope = z.infer<typeof editScopeSchema>

const eventFields = {
  title: z.string().trim().min(1, '请输入标题').max(100),
  location: z.string().trim().max(100).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  color: colorSchema.nullable().optional(),
  startAt: timestampSchema,
  endAt: timestampSchema,
  allDay: z.boolean().default(false),
  rrule: rruleSchema.nullable().optional(),
  visibility: visibilitySchema.default('family'),
  participantIds: z.array(idSchema).max(20).default([]),
  remindOffsets: remindOffsetsSchema.default([]),
}

export const eventInput = z
  .object(eventFields)
  .refine((v) => v.endAt >= v.startAt, { message: '结束时间不能早于开始时间', path: ['endAt'] })
export type EventInput = z.infer<typeof eventInput>

export const eventPatch = z.object({
  title: eventFields.title.optional(),
  location: eventFields.location,
  note: eventFields.note,
  color: eventFields.color,
  startAt: timestampSchema.optional(),
  endAt: timestampSchema.optional(),
  allDay: z.boolean().optional(),
  rrule: eventFields.rrule,
  visibility: visibilitySchema.optional(),
  participantIds: z.array(idSchema).max(20).optional(),
  remindOffsets: remindOffsetsSchema.optional(),
})
export type EventPatch = z.infer<typeof eventPatch>

export const eventScopeQuery = z.object({
  scope: editScopeSchema.default('all'),
  occurrence: z.coerce.number().int().optional(),
})

export const eventRangeQuery = z
  .object({
    from: z.coerce.number().int(),
    to: z.coerce.number().int(),
  })
  .refine((v) => v.to > v.from && v.to - v.from <= 1000 * 60 * 60 * 24 * 120, {
    message: '查询区间无效（最长 120 天）',
  })

export const parseInput = z.object({ text: z.string().trim().min(1).max(200) })

export type QuickEntryDraft = {
  title: string
  startAt: number
  endAt: number
  allDay: boolean
  rrule: string | null
  remindOffsets: number[]
  participantIds: string[]
}
