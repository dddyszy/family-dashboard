import {
  DEFAULT_HOUSEHOLD_SETTINGS,
  type HouseholdSettings,
  isValidTimeZone,
  mergeSettings,
  type UpdateSettingsInput,
  updateSettingsInput,
} from '@shared/schemas/settings'
import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { settings } from '../db/schema'
import type { Deps } from '../lib/context'
import { badRequest } from '../lib/errors'

const HOUSEHOLD_KEY = 'household'

const cache = new WeakMap<Db, HouseholdSettings>()

export function getHousehold({ db }: Pick<Deps, 'db'>): HouseholdSettings {
  const cached = cache.get(db)
  if (cached) return cached
  const row = db.select().from(settings).where(eq(settings.key, HOUSEHOLD_KEY)).get()
  // Stored settings are applied as a patch so fields added in later versions get their defaults.
  const parsed = updateSettingsInput.safeParse(row?.value ?? {})
  const value = parsed.success
    ? mergeSettings(DEFAULT_HOUSEHOLD_SETTINGS, parsed.data)
    : DEFAULT_HOUSEHOLD_SETTINGS
  cache.set(db, value)
  return value
}

export function clearHouseholdCache(db: Db): void {
  cache.delete(db)
}

export function getTimeZone(deps: Pick<Deps, 'db'>): string {
  return getHousehold(deps).timezone
}

export function updateHousehold(deps: Deps, input: UpdateSettingsInput): HouseholdSettings {
  if (input.timezone && !isValidTimeZone(input.timezone)) throw badRequest('时区无效')
  const next = mergeSettings(getHousehold(deps), input)
  const ts = deps.now()
  deps.db
    .insert(settings)
    .values({ key: HOUSEHOLD_KEY, value: next, createdAt: ts, updatedAt: ts })
    .onConflictDoUpdate({ target: settings.key, set: { value: next, updatedAt: ts } })
    .run()
  cache.set(deps.db, next)
  return next
}
