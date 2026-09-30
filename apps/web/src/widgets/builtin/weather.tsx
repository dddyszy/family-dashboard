import { CloudSun } from 'lucide-react'
import { z } from 'zod'
import { useWeather } from '@/modules/home/queries'
import { registerWidget, type WidgetProps } from '../registry'
import { describeWeather } from './weather-codes'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function dayLabel(date: string, index: number): string {
  if (index === 0) return '今天'
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number)
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? ''
}

function WeatherWidget({ size }: WidgetProps) {
  const { data, isError } = useWeather()
  if (!data) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-fg-muted">
        {isError ? '暂时无法获取天气' : '正在获取天气…'}
      </div>
    )
  }
  const now = describeWeather(data.current.weatherCode, data.current.isDay)
  const today = data.daily[0]
  const Icon = now.icon

  const summary = (
    <div className="flex flex-col">
      <p className="text-sm font-semibold">{data.location}</p>
      <p className="mt-1 text-5xl leading-none font-light tabular-nums">
        {Math.round(data.current.temperature)}°
      </p>
    </div>
  )

  if (size === 'S') {
    return (
      <div className="flex h-full flex-col justify-between p-4">
        {summary}
        <div>
          <Icon className="mb-1 size-5" style={{ color: now.color }} />
          <p className="text-sm font-medium">{now.label}</p>
          {today ? (
            <p className="text-xs text-fg-muted">
              最高 {Math.round(today.max)}° 最低 {Math.round(today.min)}°
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  const days = data.daily.slice(0, size === 'M' ? 5 : 6)
  return (
    <div className="flex h-full flex-col justify-between gap-2 p-4">
      <div className="flex items-start justify-between">
        {summary}
        <div className="text-right">
          <Icon className="ml-auto size-8" style={{ color: now.color }} />
          <p className="mt-1 text-sm font-medium">{now.label}</p>
          <p className="text-xs text-fg-muted">
            体感 {Math.round(data.current.apparentTemperature)}° · 湿度 {data.current.humidity}%
          </p>
        </div>
      </div>
      <div className={size === 'M' ? 'flex justify-between' : 'flex flex-col gap-2'}>
        {days.map((d, i) => {
          const info = describeWeather(d.weatherCode)
          return size === 'M' ? (
            <div key={d.date} className="flex flex-col items-center gap-0.5 text-xs">
              <span className="text-fg-muted">{dayLabel(d.date, i)}</span>
              <info.icon className="size-4.5" style={{ color: info.color }} />
              <span className="tabular-nums">
                {Math.round(d.max)}°/{Math.round(d.min)}°
              </span>
            </div>
          ) : (
            <div key={d.date} className="flex items-center gap-3 text-sm">
              <span className="w-10 text-fg-muted">{dayLabel(d.date, i)}</span>
              <info.icon className="size-5" style={{ color: info.color }} />
              <span className="flex-1">{info.label}</span>
              <span className="tabular-nums text-fg-muted">{Math.round(d.min)}°</span>
              <span className="w-8 text-right tabular-nums">{Math.round(d.max)}°</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

registerWidget({
  type: 'weather.basic',
  title: '天气',
  description: '当前天气与未来几天预报',
  group: '通用',
  icon: CloudSun,
  sizes: ['S', 'M', 'L'],
  defaultSize: 'S',
  configSchema: z.object({}),
  component: WeatherWidget,
})
