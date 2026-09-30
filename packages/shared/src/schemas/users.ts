import { z } from 'zod'
import { ROLES, THEMES, WALLPAPERS } from '../constants'
import { colorSchema, idSchema } from './common'

export const roleSchema = z.enum(ROLES)
export const themeSchema = z.enum(THEMES)
export const wallpaperSchema = z.union([z.enum(WALLPAPERS), z.string().startsWith('/uploads/')])

export const userPrefsSchema = z.object({
  theme: themeSchema.default('liquid-glass-light'),
  autoDark: z.boolean().default(true),
  wallpaper: wallpaperSchema.default('aurora'),
  perfMode: z.boolean().default(false),
  refraction: z.boolean().default(false),
})
export type UserPrefs = z.infer<typeof userPrefsSchema>

export const DEFAULT_USER_PREFS: UserPrefs = userPrefsSchema.parse({})

export const publicUserSchema = z.object({
  id: idSchema,
  username: z.string(),
  name: z.string(),
  avatar: z.string().nullable(),
  color: z.string(),
  role: roleSchema,
})
export type PublicUser = z.infer<typeof publicUserSchema>

export type Me = PublicUser & { prefs: UserPrefs }

const usernameSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_]{2,32}$/, '用户名只能包含字母、数字和下划线，长度 2-32')
  .transform((v) => v.toLowerCase())
const displayNameSchema = z.string().trim().min(1, '请输入名字').max(32)
const passwordSchema = z.string().min(6, '密码至少 6 位').max(128)

export const createUserInput = z.object({
  username: usernameSchema,
  name: displayNameSchema,
  password: passwordSchema,
  role: roleSchema.default('member'),
  color: colorSchema.optional(),
})
export type CreateUserInput = z.infer<typeof createUserInput>

export const updateUserInput = z.object({
  name: displayNameSchema.optional(),
  color: colorSchema.optional(),
  avatar: z.string().max(200).nullable().optional(),
  role: roleSchema.optional(),
  password: passwordSchema.optional(),
})
export type UpdateUserInput = z.infer<typeof updateUserInput>

export const updateMeInput = z.object({
  name: displayNameSchema.optional(),
  color: colorSchema.optional(),
  avatar: z.string().max(200).nullable().optional(),
  prefs: userPrefsSchema.partial().optional(),
  currentPassword: z.string().optional(),
  newPassword: passwordSchema.optional(),
})
export type UpdateMeInput = z.infer<typeof updateMeInput>

export const setupInput = z.object({
  username: usernameSchema,
  name: displayNameSchema,
  password: passwordSchema,
})
export type SetupInput = z.infer<typeof setupInput>

export const registerInput = setupInput
export type RegisterInput = z.infer<typeof registerInput>

export const loginInput = z.object({
  username: z.string().trim().min(1, '请输入用户名').toLowerCase(),
  password: z.string().min(1, '请输入密码'),
})
export type LoginInput = z.infer<typeof loginInput>

export type AuthStatus = { initialized: boolean; registrationOpen: boolean }

export type DeviceInfo = { id: string; name: string }

export type MeResponse =
  | { kind: 'user'; user: Me }
  | { kind: 'device'; device: DeviceInfo }
  | { kind: 'anonymous' }
