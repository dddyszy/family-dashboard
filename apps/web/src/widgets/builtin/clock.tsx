import { getZonedParts } from '@shared/time'
import { Clock } from 'lucide-react'
import { z } from 'zod'
import { lunarDate } from '@/lib/lunar'
import { formatTime, weekdayLabel } from '@/lib/time'
import { useNow } from '@/lib/use-now'
import { useTimeZone } from '@/modules/settings/queries'
import { registerWidget, type WidgetProps } from '../registry'

function ClockWidget({ size }: WidgetProps) {
  const timeZone = useTimeZone()
  const now = useNow(1000)
  const p = getZonedParts(now, timeZone)
  const lunar = lunarDate(now, timeZone)
  const time = formatTime(now, timeZone)

  if (size === 'S') {
    return (
      <div className="flex h-full flex-col justify-between p-[clamp(1rem,5cqw,2rem)]">
        <p className="text-[clamp(0.875rem,3cqw,1.25rem)] font-semibold text-danger">
          {weekdayLabel(now, timeZone)}
        </p>
        <p className="text-[clamp(2.25rem,20cqw,5rem)] leading-none font-semibold tracking-tight tabular-nums">
          {time}
        </p>
        <p className="text-[clamp(0.75rem,4.5cqw,1rem)] text-fg-muted">
          {p.month}月{p.day}日{lunar ? ` · ${lunar}` : ''}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-between gap-4 p-[clamp(1.25rem,4cqw,2rem)]">
      <div className="flex flex-col">
        <p className="text-[clamp(0.875rem,3cqw,1.25rem)] font-semibold text-danger">
          {weekdayLabel(now, timeZone)}
        </p>
        <p className="text-[clamp(3rem,12cqw,6rem)] leading-none font-bold tabular-nums">{p.day}</p>
        <p className="mt-1 text-[clamp(0.875rem,3cqw,1.25rem)] text-fg-muted">
          {p.year}年{p.month}月
        </p>
      </div>
      <div className="text-right">
        <p className="text-[clamp(3rem,14cqw,7rem)] leading-none font-semibold tracking-tight tabular-nums">
          {time}
        </p>
        {lunar ? (
          <p className="mt-1 text-[clamp(0.875rem,3cqw,1.25rem)] text-fg-muted">农历{lunar}</p>
        ) : null}
      </div>
    </div>
  )
}

registerWidget({
  type: 'clock.basic',
  title: '时钟',
  description: '时间、日期、星期与农历',
  group: '通用',
  icon: Clock,
  sizes: ['S', 'M'],
  defaultSize: 'S',
  configSchema: z.object({}),
  component: ClockWidget,
})
