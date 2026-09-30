const DAY_NAMES = [
  '初一',
  '初二',
  '初三',
  '初四',
  '初五',
  '初六',
  '初七',
  '初八',
  '初九',
  '初十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
  '廿一',
  '廿二',
  '廿三',
  '廿四',
  '廿五',
  '廿六',
  '廿七',
  '廿八',
  '廿九',
  '三十',
]

const cache = new Map<string, Intl.DateTimeFormat>()

function lunarFormatter(timeZone: string): Intl.DateTimeFormat | null {
  let f = cache.get(timeZone)
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { timeZone, month: 'long', day: 'numeric' })
    } catch {
      return null
    }
    cache.set(timeZone, f)
  }
  return f
}

/** e.g. "八月十一"; empty string when the runtime lacks the Chinese calendar. */
export function lunarDate(ms: number, timeZone: string): string {
  const f = lunarFormatter(timeZone)
  if (!f) return ''
  let month = ''
  let day = 0
  for (const part of f.formatToParts(ms)) {
    if (part.type === 'month') month = part.value
    if (part.type === 'day') day = Number.parseInt(part.value, 10)
  }
  const dayName = DAY_NAMES[day - 1]
  if (!month || !dayName) return ''
  return `${month}${dayName}`
}

export function lunarDay(ms: number, timeZone: string): string {
  const full = lunarDate(ms, timeZone)
  if (!full) return ''
  return full.endsWith('初一') ? full.replace('初一', '') : full.slice(-2)
}
