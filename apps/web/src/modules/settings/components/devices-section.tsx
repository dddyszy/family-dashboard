import type { HouseholdSettings } from '@shared/schemas/settings'
import { MonitorSmartphone, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/button'
import { Field, Input, Segmented } from '@/components/form'
import { Glass } from '@/components/glass'
import { EmptyState, Section } from '@/components/misc'
import { errorMessage } from '@/lib/api'
import { useNow } from '@/lib/use-now'
import { toast } from '@/stores/ui'
import { settingsApi } from '../api'
import { useDevices, useHouseholdSettings, useRevokeDevice, useUpdateHousehold } from '../queries'
import { ThemePicker, WallpaperPicker } from './theme-picker'

export function DevicesSection() {
  const devices = useDevices(true)
  const revoke = useRevokeDevice()
  const [pairing, setPairing] = useState<{ code: string; expiresAt: number } | null>(null)
  const now = useNow(1000)
  const remaining = pairing ? Math.max(0, Math.round((pairing.expiresAt - now) / 1000)) : 0

  const generate = async () => {
    try {
      setPairing(await settingsApi.pairingCode())
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Glass className="p-5">
        <Section
          title="大屏设备"
          description="挂墙平板打开 /kiosk 并输入配对码，即可以只读方式显示家庭公共大屏"
          actions={
            <Button variant="primary" size="sm" onClick={generate}>
              添加设备
            </Button>
          }
        >
          {pairing && remaining > 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface p-5 text-center">
              <p className="text-sm text-fg-muted">在大屏上输入以下配对码</p>
              <p className="font-mono text-4xl font-bold tracking-[0.3em]">{pairing.code}</p>
              <p className="text-xs text-fg-subtle">
                {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')} 后失效
              </p>
            </div>
          ) : null}
          {devices.data?.length ? (
            <ul className="divide-y divide-line">
              {devices.data.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-3">
                  <MonitorSmartphone className="size-5 text-fg-muted" />
                  <div className="flex-1">
                    <p className="font-medium">{d.name}</p>
                    <p className="text-sm text-fg-muted">
                      {d.lastSeenAt
                        ? `最近在线：${new Date(d.lastSeenAt).toLocaleString('zh-CN')}`
                        : '尚未上线'}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`吊销${d.name}`}
                    onClick={() =>
                      revoke.mutate(d.id, { onSuccess: () => toast.success('已吊销该设备') })
                    }
                  >
                    <Trash2 className="size-4 text-danger" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={MonitorSmartphone} title="还没有配对的大屏" />
          )}
        </Section>
      </Glass>
      <KioskAppearance />
    </div>
  )
}

function KioskAppearance() {
  const current = useHouseholdSettings()
  const update = useUpdateHousehold()
  const [kiosk, setKiosk] = useState<HouseholdSettings['kiosk']>(current.kiosk)
  useEffect(() => setKiosk(current.kiosk), [current.kiosk])

  const save = (patch: Partial<HouseholdSettings['kiosk']>) => {
    const next = { ...kiosk, ...patch }
    setKiosk(next)
    update.mutate({ kiosk: next }, { onError: (err) => toast.error(errorMessage(err)) })
  }

  return (
    <Glass className="p-5">
      <Section title="大屏外观" description="所有大屏设备共用">
        <div className="flex flex-col gap-5">
          <ThemePicker value={kiosk.theme} onChange={(theme) => save({ theme })} />
          <WallpaperPicker value={kiosk.wallpaper} onChange={(wallpaper) => save({ wallpaper })} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="夜间开始">
              <Input
                type="time"
                value={kiosk.nightStart}
                onChange={(e) => save({ nightStart: e.target.value })}
              />
            </Field>
            <Field label="夜间结束">
              <Input
                type="time"
                value={kiosk.nightEnd}
                onChange={(e) => save({ nightEnd: e.target.value })}
              />
            </Field>
            <Field label="夜间显示">
              <Segmented
                value={kiosk.nightMode}
                onChange={(nightMode) => save({ nightMode })}
                options={[
                  { value: 'clock', label: '大时钟' },
                  { value: 'dim', label: '调暗' },
                ]}
              />
            </Field>
          </div>
        </div>
      </Section>
    </Glass>
  )
}
