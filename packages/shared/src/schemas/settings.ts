import { z } from 'zod'
import { DEFAULT_TIMEZONE } from '../constants'
import { hmSchema } from './common'
import { themeSchema, wallpaperSchema } from './users'

const weatherSchema = z.object({
  name: z.string().max(32),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
})

const darkWindowSchema = z.object({ start: hmSchema, end: hmSchema })

const kioskSchema = z.object({
  theme: themeSchema,
  wallpaper: wallpaperSchema,
  nightStart: hmSchema,
  nightEnd: hmSchema,
  nightMode: z.enum(['dim', 'clock']),
})

export const householdSettingsSchema = z.object({
  timezone: z.string(),
  weather: weatherSchema,
  darkWindow: darkWindowSchema,
  kiosk: kioskSchema,
  allowRegistration: z.boolean(),
})
export type HouseholdSettings = z.infer<typeof householdSettingsSchema>

export const DEFAULT_HOUSEHOLD_SETTINGS: HouseholdSettings = {
  timezone: DEFAULT_TIMEZONE,
  weather: { name: '上海', lat: 31.23, lon: 121.47 },
  darkWindow: { start: '22:00', end: '07:00' },
  kiosk: {
    theme: 'liquid-glass-dark',
    wallpaper: 'aurora',
    nightStart: '23:00',
    nightEnd: '06:30',
    nightMode: 'clock',
  },
  allowRegistration: false,
}

/*
 * No defaults here: zod fills defaults even inside `.partial()`, which would silently reset every
 * field a PATCH omits. Omitted fields, top-level or nested, keep their stored value.
 */
export const updateSettingsInput = z
  .object({
    timezone: z.string(),
    weather: weatherSchema.partial(),
    darkWindow: darkWindowSchema.partial(),
    kiosk: kioskSchema.partial(),
    allowRegistration: z.boolean(),
  })
  .partial()
export type UpdateSettingsInput = z.infer<typeof updateSettingsInput>

export function mergeSettings(
  base: HouseholdSettings,
  patch: UpdateSettingsInput,
): HouseholdSettings {
  return {
    timezone: patch.timezone ?? base.timezone,
    weather: { ...base.weather, ...patch.weather },
    darkWindow: { ...base.darkWindow, ...patch.darkWindow },
    kiosk: { ...base.kiosk, ...patch.kiosk },
    allowRegistration: patch.allowRegistration ?? base.allowRegistration,
  }
}

export const isValidTimeZone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
