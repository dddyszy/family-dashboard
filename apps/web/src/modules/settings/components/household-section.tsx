import type { HouseholdSettings } from '@shared/schemas/settings'
import { type FormEvent, useEffect, useState } from 'react'
import { Button } from '@/components/button'
import { Field, Input, Select } from '@/components/form'
import { Glass } from '@/components/glass'
import { Section } from '@/components/misc'
import { errorMessage } from '@/lib/api'
import { toast } from '@/stores/ui'
import { useHouseholdSettings, useUpdateHousehold } from '../queries'

const CITIES: Array<{ name: string; lat: number; lon: number }> = [
  { name: '北京', lat: 39.9, lon: 116.4 },
  { name: '上海', lat: 31.23, lon: 121.47 },
  { name: '广州', lat: 23.13, lon: 113.26 },
  { name: '深圳', lat: 22.54, lon: 114.06 },
  { name: '杭州', lat: 30.27, lon: 120.15 },
  { name: '南京', lat: 32.06, lon: 118.8 },
  { name: '苏州', lat: 31.3, lon: 120.58 },
  { name: '成都', lat: 30.57, lon: 104.07 },
  { name: '重庆', lat: 29.56, lon: 106.55 },
  { name: '武汉', lat: 30.59, lon: 114.31 },
  { name: '西安', lat: 34.34, lon: 108.94 },
  { name: '天津', lat: 39.13, lon: 117.2 },
  { name: '长沙', lat: 28.23, lon: 112.94 },
  { name: '厦门', lat: 24.48, lon: 118.09 },
  { name: '青岛', lat: 36.07, lon: 120.38 },
  { name: '香港', lat: 22.32, lon: 114.17 },
  { name: '台北', lat: 25.03, lon: 121.56 },
  { name: '新加坡', lat: 1.35, lon: 103.82 },
]

const TIMEZONES = [
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Taipei',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'America/Los_Angeles',
  'America/New_York',
]

export function HouseholdSection() {
  const current = useHouseholdSettings()
  const update = useUpdateHousehold()
  const [form, setForm] = useState<HouseholdSettings>(current)
  useEffect(() => setForm(current), [current])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    update.mutate(
      { timezone: form.timezone, weather: form.weather, darkWindow: form.darkWindow },
      {
        onSuccess: () => toast.success('家庭设置已保存'),
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  const cityValue = CITIES.find((c) => c.name === form.weather.name)?.name ?? '__custom'

  return (
    <Glass className="p-5">
      <Section title="家庭设置" description="对全家生效">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <Field label="家庭时区" hint="日程与提醒都按这个时区计算">
            <Select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            >
              {[...new Set([form.timezone, ...TIMEZONES])].map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="天气城市">
            <Select
              value={cityValue}
              onChange={(e) => {
                const city = CITIES.find((c) => c.name === e.target.value)
                if (city) setForm({ ...form, weather: city })
                else setForm({ ...form, weather: { ...form.weather, name: '自定义' } })
              }}
            >
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
              <option value="__custom">自定义经纬度…</option>
            </Select>
          </Field>
          {cityValue === '__custom' ? (
            <>
              <Field label="地点名称">
                <Input
                  value={form.weather.name}
                  onChange={(e) =>
                    setForm({ ...form, weather: { ...form.weather, name: e.target.value } })
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="纬度">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.weather.lat}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        weather: { ...form.weather, lat: Number(e.target.value) },
                      })
                    }
                  />
                </Field>
                <Field label="经度">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.weather.lon}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        weather: { ...form.weather, lon: Number(e.target.value) },
                      })
                    }
                  />
                </Field>
              </div>
            </>
          ) : null}
          <Field label="夜间深色开始">
            <Input
              type="time"
              value={form.darkWindow.start}
              onChange={(e) =>
                setForm({ ...form, darkWindow: { ...form.darkWindow, start: e.target.value } })
              }
            />
          </Field>
          <Field label="夜间深色结束">
            <Input
              type="time"
              value={form.darkWindow.end}
              onChange={(e) =>
                setForm({ ...form, darkWindow: { ...form.darkWindow, end: e.target.value } })
              }
            />
          </Field>
          <div className="md:col-span-2">
            <Button type="submit" variant="primary" loading={update.isPending}>
              保存家庭设置
            </Button>
          </div>
        </form>
      </Section>
    </Glass>
  )
}
