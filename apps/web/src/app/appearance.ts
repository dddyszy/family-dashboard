import type { Theme } from '@shared/constants'
import type { HouseholdSettings } from '@shared/schemas/settings'
import type { UserPrefs } from '@shared/schemas/users'
import { getZonedParts, isWithinDailyWindow } from '@shared/time'
import { useEffect } from 'react'
import { useNow } from '@/lib/use-now'

export type Appearance = {
  theme: Theme
  wallpaper: string
  perf: boolean
  refraction: boolean
}

const DARK_THEMES: ReadonlySet<Theme> = new Set(['liquid-glass-dark', 'wall-display'])

function isChromium(): boolean {
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } })
    .userAgentData?.brands
  return Boolean(brands?.some((b) => b.brand === 'Chromium'))
}

export function applyAppearance(a: Appearance): void {
  const root = document.documentElement
  root.dataset.theme = a.theme
  if (a.wallpaper.startsWith('/uploads/')) {
    root.dataset.wallpaper = 'custom'
    root.style.setProperty('--wallpaper-image', `url("${a.wallpaper}")`)
  } else {
    root.dataset.wallpaper = a.wallpaper
    root.style.removeProperty('--wallpaper-image')
  }
  root.dataset.perf = a.perf ? 'on' : 'off'
  root.classList.toggle('refraction', a.refraction && isChromium())
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', DARK_THEMES.has(a.theme) ? '#101624' : '#dfe6f3')
  localStorage.setItem('fd-appearance', JSON.stringify(a))
}

function minutesOfDay(now: number, timeZone: string): number {
  const p = getZonedParts(now, timeZone)
  return p.hour * 60 + p.minute
}

export function resolveUserAppearance(
  prefs: UserPrefs,
  household: HouseholdSettings,
  now: number,
): Appearance {
  const inDarkWindow = isWithinDailyWindow(
    minutesOfDay(now, household.timezone),
    household.darkWindow.start,
    household.darkWindow.end,
  )
  const theme: Theme =
    prefs.autoDark && prefs.theme === 'liquid-glass-light' && inDarkWindow
      ? 'liquid-glass-dark'
      : prefs.theme
  return { theme, wallpaper: prefs.wallpaper, perf: prefs.perfMode, refraction: prefs.refraction }
}

export function useApplyAppearance(resolve: (now: number) => Appearance | null): void {
  const now = useNow(60_000)
  const appearance = resolve(now)
  const key = appearance ? JSON.stringify(appearance) : ''
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` captures the resolved value
  useEffect(() => {
    if (appearance) applyAppearance(appearance)
  }, [key])
}
