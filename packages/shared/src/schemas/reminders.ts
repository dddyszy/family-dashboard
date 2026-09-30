import { z } from 'zod'

export const REMINDER_SOURCE_TYPES = ['event', 'todo'] as const
export type ReminderSourceType = (typeof REMINDER_SOURCE_TYPES)[number]

export const REMINDER_STATUSES = ['pending', 'fired', 'dismissed', 'expired'] as const
export type ReminderStatus = (typeof REMINDER_STATUSES)[number]

export type ReminderPayload = {
  title: string
  startAt: number
  allDay: boolean
  location: string | null
  family: boolean
}

export type Reminder = {
  id: string
  sourceType: ReminderSourceType
  sourceId: string
  occurrenceAt: number
  fireAt: number
  status: ReminderStatus
  payload: ReminderPayload
}

export const snoozeInput = z.object({
  minutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .optional(),
})
