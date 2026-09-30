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

/*
 * The rrule library loops until year 9999 when a rule can never match (e.g. 30 February) and
 * never terminates for a negative INTERVAL, blocking the single-threaded server. Only accept the
 * parts each frequency needs, so every accepted rule yields occurrences within a few years.
 */
const RRULE_KEYS: Record<string, readonly string[]> = {
  DAILY: ['INTERVAL', 'COUNT', 'UNTIL', 'BYDAY'],
  WEEKLY: ['INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'WKST'],
  MONTHLY: ['INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY'],
  YEARLY: ['INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY', 'BYMONTH'],
}
const MAX_DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** Parses a comma list of non-zero integers whose magnitude is at most `max`. */
function intList(value: string, max: number): number[] | null {
  const numbers = value.split(',').map((item) => (/^[+-]?\d{1,2}$/.test(item) ? Number(item) : 0))
  return numbers.every((n) => n !== 0 && Math.abs(n) <= max) ? numbers : null
}

/** Returns why a rule is rejected, or null when it is safe to expand. */
export function rruleProblem(rrule: string): string | null {
  const segments = rrule.split(';')
  const parts = parseRruleParts(rrule)
  if (parts.size !== segments.length) return '重复规则中有重复或无效的字段'
  const freq = parts.get('FREQ') ?? ''
  const allowed = RRULE_KEYS[freq]
  if (!allowed) return '重复频率只支持每天、每周、每月、每年'
  for (const key of parts.keys()) {
    if (key !== 'FREQ' && !allowed.includes(key)) return `重复规则不支持 ${key}`
  }
  const interval = parts.get('INTERVAL')
  if (interval !== undefined && !/^([1-9]\d?)$/.test(interval)) return '重复间隔应为 1–99'
  const count = parts.get('COUNT')
  if (count !== undefined && !/^\d{1,4}$/.test(count)) return '重复次数应为 1–1000'
  if (count !== undefined && (Number(count) < 1 || Number(count) > 1000)) {
    return '重复次数应为 1–1000'
  }
  const until = parts.get('UNTIL')
  if (until !== undefined && !/^\d{8}(T\d{6}Z?)?$/.test(until)) return '重复截止时间格式不正确'
  if (count !== undefined && until !== undefined) return '重复次数和截止时间只能设置一个'
  const byday = parts.get('BYDAY')
  if (byday !== undefined) {
    const ordinalAllowed = freq === 'MONTHLY' || freq === 'YEARLY'
    const pattern = ordinalAllowed
      ? /^([+-]?[1-5])?(MO|TU|WE|TH|FR|SA|SU)$/
      : /^(MO|TU|WE|TH|FR|SA|SU)$/
    if (!byday.split(',').every((d) => pattern.test(d))) return '重复规则中的星期格式不正确'
    if (freq === 'DAILY' && interval !== undefined && interval !== '1') {
      return '按天间隔重复时不能再限定星期'
    }
  }
  const bymonthday = parts.get('BYMONTHDAY')
  const monthDays = bymonthday === undefined ? null : intList(bymonthday, 31)
  if (bymonthday !== undefined && !monthDays) return '重复规则中的日期应为 1–31'
  const bymonth = parts.get('BYMONTH')
  const months = bymonth === undefined ? null : intList(bymonth, 12)
  if (bymonth !== undefined && (!months || months.some((m) => m < 0))) {
    return '重复规则中的月份应为 1–12'
  }
  if (monthDays) {
    const candidates = months ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    const possible = candidates.some((m) =>
      monthDays.some((d) => Math.abs(d) <= (MAX_DAYS_IN_MONTH[m - 1] ?? 0)),
    )
    if (!possible) return '重复规则中的日期在所选月份中不存在'
  }
  const wkst = parts.get('WKST')
  if (wkst !== undefined && !/^(MO|TU|WE|TH|FR|SA|SU)$/.test(wkst)) return '一周起始日格式不正确'
  return null
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
