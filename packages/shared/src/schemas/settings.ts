import { z } from 'zod'
import { DEFAULT_TIMEZONE } from '../constants'
import { hmSchema } from './common'
import { themeSchema, wallpaperSchema } from './users'

export const householdSettingsSchema = z.object({
  timezone: z.string().default(DEFAULT_TIMEZONE),
  weather: z
    .object({
      name: z.string().max(32).default('上海'),
      lat: z.number().min(-90).max(90).default(31.23),
      lon: z.number().min(-180).max(180).default(121.47),
    })
    .default({ name: '上海', lat: 31.23, lon: 121.47 }),
  darkWindow: z
    .object({ start: hmSchema.default('22:00'), end: hmSchema.default('07:00') })
    .default({ start: '22:00', end: '07:00' }),
  kiosk: z
    .object({
      theme: themeSchema.default('liquid-glass-dark'),
      wallpaper: wallpaperSchema.default('aurora'),
      nightStart: hmSchema.default('23:00'),
      nightEnd: hmSchema.default('06:30'),
      nightMode: z.enum(['dim', 'clock']).default('clock'),
    })
    .default({
      theme: 'liquid-glass-dark',
      wallpaper: 'aurora',
      nightStart: '23:00',
      nightEnd: '06:30',
      nightMode: 'clock',
    }),
})
export type HouseholdSettings = z.infer<typeof householdSettingsSchema>

export const updateSettingsInput = householdSettingsSchema.partial()
export type UpdateSettingsInput = z.infer<typeof updateSettingsInput>

export const DEFAULT_HOUSEHOLD_SETTINGS: HouseholdSettings = householdSettingsSchema.parse({})

export const isValidTimeZone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
