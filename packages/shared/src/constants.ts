export const VISIBILITIES = ['private', 'family'] as const
export type Visibility = (typeof VISIBILITIES)[number]

export const ROLES = ['admin', 'member'] as const
export type Role = (typeof ROLES)[number]

export const THEMES = [
  'liquid-glass-light',
  'liquid-glass-dark',
  'classic',
  'minimal',
  'wall-display',
] as const
export type Theme = (typeof THEMES)[number]

export const THEME_LABELS: Record<Theme, string> = {
  'liquid-glass-light': '液态玻璃 · 浅色',
  'liquid-glass-dark': '液态玻璃 · 深色',
  classic: '经典',
  minimal: '极简',
  'wall-display': '大屏高对比',
}

export const WALLPAPERS = ['aurora', 'sunset', 'ocean', 'forest', 'graphite'] as const
export type Wallpaper = (typeof WALLPAPERS)[number]

export const WALLPAPER_LABELS: Record<Wallpaper, string> = {
  aurora: '极光',
  sunset: '日落',
  ocean: '海洋',
  forest: '森林',
  graphite: '石墨',
}

export const MEMBER_COLORS = [
  '#0a84ff',
  '#ff375f',
  '#30d158',
  '#ff9f0a',
  '#bf5af2',
  '#64d2ff',
  '#ffd60a',
  '#ac8e68',
] as const

export const SHOPPING_CATEGORIES = [
  '蔬果',
  '肉蛋',
  '水产',
  '乳品',
  '粮油',
  '零食饮料',
  '日用',
  '清洁',
  '母婴',
  '药品',
  '其他',
] as const

export const DEFAULT_CATEGORY = '其他'

export const REMIND_PRESETS: ReadonlyArray<{ minutes: number; label: string }> = [
  { minutes: 0, label: '准时' },
  { minutes: 5, label: '提前 5 分钟' },
  { minutes: 15, label: '提前 15 分钟' },
  { minutes: 30, label: '提前 30 分钟' },
  { minutes: 60, label: '提前 1 小时' },
  { minutes: 1440, label: '提前 1 天' },
]

export const DEFAULT_TIMEZONE = 'Asia/Shanghai'

export const REMINDER_HORIZON_DAYS = 60
export const REMINDER_ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000
export const DEFAULT_SNOOZE_MINUTES = 10

export const FAMILY_DASHBOARD_ID = 'family'
