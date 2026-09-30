import { getZonedParts } from './time'

export const RECURRENCE_PRESETS = [
  'none',
  'daily',
  'weekdays',
  'weekly',
  'biweekly',
  'monthly',
  'yearly',
  'custom',
] as const
export type RecurrencePreset = (typeof RECURRENCE_PRESETS)[number]

export const RECURRENCE_LABELS: Record<RecurrencePreset, string> = {
  none: '不重复',
  daily: '每天',
  weekdays: '工作日',
  weekly: '每周',
  biweekly: '每两周',
  monthly: '每月',
  yearly: '每年',
  custom: '自定义',
}

export const BYDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const
const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

export function parseRruleParts(rrule: string): Map<string, string> {
  const parts = new Map<string, string>()
  for (const segment of rrule.replace(/^RRULE:/, '').split(';')) {
    const [key, value] = segment.split('=')
    if (key && value !== undefined) parts.set(key.toUpperCase(), value)
  }
  return parts
}

export function stringifyRruleParts(parts: Map<string, string>): string {
  const ordered = ['FREQ', ...[...parts.keys()].filter((k) => k !== 'FREQ')]
  return ordered
    .filter((k) => parts.has(k))
    .map((k) => `${k}=${parts.get(k)}`)
    .join(';')
}

export function buildPresetRrule(
  preset: RecurrencePreset,
  startAt: number,
  timeZone: string,
): string | null {
  const p = getZonedParts(startAt, timeZone)
  const byday = BYDAY_CODES[p.weekday]
  switch (preset) {
    case 'none':
    case 'custom':
      return null
    case 'daily':
      return 'FREQ=DAILY'
    case 'weekdays':
      return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
    case 'weekly':
      return `FREQ=WEEKLY;BYDAY=${byday}`
    case 'biweekly':
      return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${byday}`
    case 'monthly':
      return `FREQ=MONTHLY;BYMONTHDAY=${p.day}`
    case 'yearly':
      return 'FREQ=YEARLY'
  }
}

export function detectPreset(
  rrule: string | null,
  startAt: number,
  timeZone: string,
): RecurrencePreset {
  if (!rrule) return 'none'
  const core = stripLimits(rrule)
  for (const preset of RECURRENCE_PRESETS) {
    if (preset === 'none' || preset === 'custom') continue
    if (buildPresetRrule(preset, startAt, timeZone) === core) return preset
  }
  return 'custom'
}

/** Removes UNTIL/COUNT so a rule can be compared with or reused as a preset. */
export function stripLimits(rrule: string): string {
  const parts = parseRruleParts(rrule)
  parts.delete('UNTIL')
  parts.delete('COUNT')
  return stringifyRruleParts(parts)
}

export function describeRrule(rrule: string | null): string {
  if (!rrule) return RECURRENCE_LABELS.none
  const parts = parseRruleParts(rrule)
  const interval = Number(parts.get('INTERVAL') ?? '1')
  const byday = parts.get('BYDAY')
  const every = interval > 1 ? `每 ${interval} ` : '每'
  let text: string
  switch (parts.get('FREQ')) {
    case 'DAILY':
      text = interval > 1 ? `${every}天` : '每天'
      break
    case 'WEEKLY': {
      if (byday === 'MO,TU,WE,TH,FR' && interval === 1) {
        text = '工作日'
        break
      }
      const days = byday
        ? byday
            .split(',')
            .map((d) => WEEKDAY_NAMES[BYDAY_CODES.indexOf(d as (typeof BYDAY_CODES)[number])])
            .filter(Boolean)
            .join('、')
        : ''
      text = `${interval > 1 ? `${every}周` : '每周'}${days ? `（周${days}）` : ''}`
      break
    }
    case 'MONTHLY': {
      const day = parts.get('BYMONTHDAY')
      text = `${interval > 1 ? `${every}个月` : '每月'}${day ? ` ${day} 日` : ''}`
      break
    }
    case 'YEARLY':
      text = interval > 1 ? `${every}年` : '每年'
      break
    default:
      text = RECURRENCE_LABELS.custom
  }
  if (parts.has('UNTIL')) text += '（有截止日期）'
  if (parts.has('COUNT')) text += `，共 ${parts.get('COUNT')} 次`
  return text
}
