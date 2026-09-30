import { DAY_MS, dateKey, getZonedParts, startOfZonedDay } from '@shared/time'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(key: string, timeZone: string, options: Intl.DateTimeFormatOptions) {
  const cacheKey = `${key}|${timeZone}`
  let f = formatters.get(cacheKey)
  if (!f) {
    f = new Intl.DateTimeFormat('zh-CN', { timeZone, ...options })
    formatters.set(cacheKey, f)
  }
  return f
}

export function formatTime(ms: number, timeZone: string): string {
  return formatter('time', timeZone, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(ms)
}

export function formatMonthDay(ms: number, timeZone: string): string {
  const p = getZonedParts(ms, timeZone)
  return `${p.month}月${p.day}日`
}

export function formatFullDate(ms: number, timeZone: string): string {
  const p = getZonedParts(ms, timeZone)
  return `${p.year}年${p.month}月${p.day}日 ${WEEKDAYS[p.weekday]}`
}

export function weekdayLabel(ms: number, timeZone: string): string {
  return WEEKDAYS[getZonedParts(ms, timeZone).weekday] ?? ''
}

/** 今天 / 明天 / 后天 / 周X / M月D日 */
export function relativeDayLabel(ms: number, now: number, timeZone: string): string {
  const diff = Math.round((startOfZonedDay(ms, timeZone) - startOfZonedDay(now, timeZone)) / DAY_MS)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === 2) return '后天'
  if (diff === -1) return '昨天'
  if (diff > 0 && diff < 7) return weekdayLabel(ms, timeZone)
  return formatMonthDay(ms, timeZone)
}

export function formatEventTime(
  e: { startAt: number; endAt: number; allDay: boolean },
  timeZone: string,
): string {
  if (e.allDay) return '全天'
  const sameDay = dateKey(e.startAt, timeZone) === dateKey(e.endAt, timeZone)
  const start = formatTime(e.startAt, timeZone)
  if (e.endAt === e.startAt) return start
  return sameDay
    ? `${start} - ${formatTime(e.endAt, timeZone)}`
    : `${start} - ${formatMonthDay(e.endAt, timeZone)} ${formatTime(e.endAt, timeZone)}`
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '进行中'
  const minutes = Math.ceil(ms / 60_000)
  if (minutes < 60) return `${minutes} 分钟后`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时 ${minutes % 60} 分钟后`
  return `${Math.floor(hours / 24)} 天后`
}

export function toDateInput(ms: number, timeZone: string): string {
  return dateKey(ms, timeZone)
}

export function toTimeInput(ms: number, timeZone: string): string {
  const p = getZonedParts(ms, timeZone)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}
