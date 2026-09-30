import { getZonedParts, type ZonedParts } from '@shared/time'
import { Clock } from 'lucide-react'
import { z } from 'zod'
import { Field, Segmented } from '@/components/form'
import { cn } from '@/lib/cn'
import { lunarDate } from '@/lib/lunar'
import { weekdayLabel } from '@/lib/time'
import { useNow } from '@/lib/use-now'
import { useTimeZone } from '@/modules/settings/queries'
import { type ConfigEditorProps, registerWidget, type WidgetProps } from '../registry'

const clockConfig = z.object({ face: z.enum(['digital', 'analog']).default('digital') })
type ClockConfig = z.infer<typeof clockConfig>

const FACE_OPTIONS = [
  { value: 'digital', label: '数字' },
  { value: 'analog', label: '指针' },
] as const

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

const pad = (n: number) => String(n).padStart(2, '0')

function DigitalTime({
  parts,
  seconds,
  className,
}: {
  parts: ZonedParts
  seconds?: boolean
  className?: string
}) {
  const colon = (
    <span
      className={cn(
        'relative -top-[0.06em] mx-[0.02em] transition-opacity duration-500',
        !seconds && parts.second % 2 ? 'opacity-30' : 'opacity-100',
      )}
    >
      :
    </span>
  )
  return (
    <p
      className={cn(
        'leading-none font-semibold tracking-tight whitespace-nowrap tabular-nums',
        className,
      )}
    >
      {pad(parts.hour)}
      {colon}
      {pad(parts.minute)}
      {seconds ? (
        <>
          {colon}
          {pad(parts.second)}
        </>
      ) : null}
    </p>
  )
}

/** Monday-first week containing today, computed in the household calendar. */
function WeekStrip({ parts }: { parts: ZonedParts }) {
  const todayIndex = (parts.weekday + 6) % 7
  return (
    <div className="grid grid-cols-7 text-center text-[clamp(0.6875rem,3.2cqw,1rem)] tabular-nums">
      {WEEK_LABELS.map((label, i) => {
        const day = new Date(
          Date.UTC(parts.year, parts.month - 1, parts.day - todayIndex + i),
        ).getUTCDate()
        const today = i === todayIndex
        return (
          <div key={label} className="flex flex-col items-center gap-[0.35em]">
            <span className={cn('font-medium', today ? 'text-danger' : 'text-fg-subtle')}>
              {label}
            </span>
            <span
              className={cn(
                'inline-flex size-[2em] items-center justify-center rounded-full font-semibold',
                today ? 'bg-danger text-accent-fg' : i > 4 ? 'text-fg-muted' : 'text-fg',
              )}
            >
              {day}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function AnalogDial({
  parts,
  weekday,
  className,
}: {
  parts: ZonedParts
  weekday?: string
  className?: string
}) {
  const secondAngle = parts.second * 6
  const minuteAngle = parts.minute * 6 + parts.second * 0.1
  const hourAngle = (parts.hour % 12) * 30 + parts.minute * 0.5
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-hidden="true">
      <circle cx="50" cy="50" r="49" className="fill-surface stroke-line" strokeWidth="0.75" />
      {Array.from({ length: 60 }, (_, i) => {
        const hour = i % 5 === 0
        return (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed dial ticks
            key={i}
            x1="50"
            y1={hour ? 5.5 : 5}
            x2="50"
            y2={hour ? 12 : 8}
            strokeWidth={hour ? 2.2 : 0.8}
            strokeLinecap="round"
            className={hour ? 'stroke-fg' : 'stroke-fg-subtle'}
            transform={`rotate(${i * 6} 50 50)`}
          />
        )
      })}
      {weekday ? (
        <text x="50" y="34" textAnchor="middle" className="fill-danger text-[9px] font-semibold">
          {weekday}
        </text>
      ) : null}
      {weekday ? (
        <text
          x="50"
          y="74"
          textAnchor="middle"
          className="fill-fg-muted text-[8px] font-medium tabular-nums"
        >
          {parts.month}月{parts.day}日
        </text>
      ) : null}
      <g className="stroke-fg" strokeLinecap="round">
        <line
          x1="50"
          y1="54"
          x2="50"
          y2="27"
          strokeWidth="4"
          transform={`rotate(${hourAngle} 50 50)`}
        />
        <line
          x1="50"
          y1="56"
          x2="50"
          y2="13"
          strokeWidth="2.6"
          transform={`rotate(${minuteAngle} 50 50)`}
        />
      </g>
      <g className="fill-danger stroke-danger" transform={`rotate(${secondAngle} 50 50)`}>
        <line x1="50" y1="60" x2="50" y2="9" strokeWidth="1" strokeLinecap="round" />
        <circle cx="50" cy="50" r="2.6" />
      </g>
      <circle cx="50" cy="50" r="1" className="fill-surface-strong" />
    </svg>
  )
}

function ClockWidget({ size, config }: WidgetProps<ClockConfig>) {
  const timeZone = useTimeZone()
  const now = useNow(1000)
  const parts = getZonedParts(now, timeZone)
  const weekday = weekdayLabel(now, timeZone)
  const lunar = lunarDate(now, timeZone)
  const analog = config.face === 'analog'

  if (size === 'S') {
    if (analog) {
      return (
        <div className="flex h-full items-center justify-center p-[clamp(0.625rem,6cqw,1.25rem)]">
          <AnalogDial parts={parts} weekday={weekday} className="aspect-square max-h-full w-full" />
        </div>
      )
    }
    return (
      <div className="flex h-full flex-col justify-between p-[clamp(0.875rem,9cqw,1.75rem)]">
        <p className="flex items-baseline gap-[0.4em] text-[clamp(0.8125rem,8cqw,1.5rem)] leading-tight font-semibold">
          <span className="text-danger">{weekday}</span>
          <span>
            {parts.month}月{parts.day}日
          </span>
        </p>
        <DigitalTime parts={parts} className="text-[clamp(2.25rem,29cqw,6rem)]" />
        <p className="truncate text-[clamp(0.75rem,7cqw,1.25rem)] text-fg-muted">
          {lunar ? `农历${lunar}` : `${parts.year}年`}
        </p>
      </div>
    )
  }

  const header = (
    <div className="flex items-baseline justify-between gap-3 text-[clamp(0.8125rem,4cqw,1.375rem)] leading-tight">
      <p className="font-semibold whitespace-nowrap">
        <span className="text-danger">{weekday}</span>
        <span className="ml-[0.4em]">
          {parts.month}月{parts.day}日
        </span>
      </p>
      {lunar ? <p className="truncate text-fg-muted">农历{lunar}</p> : null}
    </div>
  )

  if (analog) {
    return (
      <div className="flex h-full gap-[clamp(0.75rem,5cqw,2rem)] p-[clamp(0.875rem,4.5cqw,1.75rem)]">
        <AnalogDial parts={parts} className="aspect-square h-full shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div className="text-[clamp(0.8125rem,4cqw,1.375rem)] leading-tight">
            <p className="font-semibold text-danger">{weekday}</p>
            <p className="mt-[0.2em] font-semibold whitespace-nowrap">
              {parts.month}月{parts.day}日
            </p>
            {lunar ? <p className="mt-[0.2em] truncate text-fg-muted">农历{lunar}</p> : null}
          </div>
          <DigitalTime parts={parts} className="text-[clamp(2rem,12cqw,5rem)]" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col justify-between gap-[clamp(0.25rem,1.5cqw,0.75rem)] p-[clamp(0.875rem,4.5cqw,1.75rem)]">
      {header}
      <DigitalTime parts={parts} seconds className="text-[clamp(2.25rem,17cqw,7rem)]" />
      <WeekStrip parts={parts} />
    </div>
  )
}

function FaceEditor({ config, onChange }: ConfigEditorProps<ClockConfig>) {
  return (
    <Field label="表盘样式">
      <Segmented
        value={config.face}
        options={FACE_OPTIONS}
        onChange={(face) => onChange({ ...config, face })}
        className="self-start"
      />
    </Field>
  )
}

registerWidget({
  type: 'clock.basic',
  title: '时钟',
  description: '时间、日期、星期与农历，可选数字或指针表盘',
  group: '通用',
  icon: Clock,
  sizes: ['S', 'M'],
  defaultSize: 'S',
  configSchema: clockConfig,
  component: ClockWidget,
  ConfigEditor: FaceEditor,
})
