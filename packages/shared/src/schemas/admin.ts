import { z } from 'zod'

export const RESET_MODES = ['content', 'factory'] as const
export type ResetMode = (typeof RESET_MODES)[number]

/** The phrase the admin must type to confirm a reset. */
export const RESET_CONFIRM_PHRASE = '重置'

export const resetInput = z.object({
  mode: z.enum(RESET_MODES),
  password: z.string().min(1, '请输入管理员密码'),
  confirm: z.literal(RESET_CONFIRM_PHRASE, { error: `请输入「${RESET_CONFIRM_PHRASE}」以确认` }),
})
export type ResetInput = z.infer<typeof resetInput>

export type ResetResult = { mode: ResetMode; backup: string | null }
