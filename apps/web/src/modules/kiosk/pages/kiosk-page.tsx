import { DEFAULT_HOUSEHOLD_SETTINGS } from '@shared/schemas/settings'
import { getZonedParts, isWithinDailyWindow } from '@shared/time'
import { useQueryClient } from '@tanstack/react-query'
import { Volume2 } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link } from 'wouter'
import { FullScreenSpinner } from '@/app/app-shell'
import { useApplyAppearance } from '@/app/appearance'
import { DrawerHost } from '@/app/drawer-host'
import { RealtimeBridge } from '@/app/realtime-bridge'
import { StatusBar } from '@/app/status-bar'
import { Button } from '@/components/button'
import { Field, Input } from '@/components/form'
import { errorMessage } from '@/lib/api'
import { lunarDate } from '@/lib/lunar'
import { unlockSound, useSoundState } from '@/lib/sound'
import { formatFullDate, formatTime } from '@/lib/time'
import { useNow } from '@/lib/use-now'
import { useWakeLock } from '@/lib/wake-lock'
import { AuthLayout } from '@/modules/auth/pages/auth-layout'
import { authKeys, useMe } from '@/modules/auth/queries'
import { DashboardGrid } from '@/modules/home/components/dashboard-grid'
import { useDashboard, useHome } from '@/modules/home/queries'
import { ReminderHost } from '@/modules/reminders/reminder-host'
import { settingsApi } from '@/modules/settings/api'
import { useHousehold } from '@/modules/settings/queries'
import { reloadWithUpdate } from '@/pwa/register'

const NIGHTLY_RELOAD_HOUR = 4
const MIN_UPTIME_BEFORE_RELOAD_MS = 60 * 60 * 1000
const WAKE_FROM_NIGHT_MS = 5 * 60 * 1000

export function KioskPage() {
  const me = useMe()
  if (!me.data) return <FullScreenSpinner />
  if (me.data.kind === 'anonymous') return <PairDevice />
  return <KioskDashboard isDevice={me.data.kind === 'device'} />
}

function PairDevice() {
  const qc = useQueryClient()
  const [code, setCode] = useState('')
  const [name, setName] = useState('客厅大屏')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError('')
    try {
      await settingsApi.pair(code, name)
      await qc.invalidateQueries({ queryKey: authKeys.me })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout title="配对大屏" subtitle="请管理员在「设置 → 大屏」中点击「添加设备」获取配对码">
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="配对码">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="6 位数字"
            className="h-14 text-center font-mono text-2xl tracking-[0.4em]"
            required
          />
        </Field>
        <Field label="设备名称">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} required />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={pending}
          disabled={code.length !== 6}
        >
          配对
        </Button>
        <Link to="/login" className="text-center text-sm text-fg-muted hover:text-fg">
          用账号登录
        </Link>
      </form>
    </AuthLayout>
  )
}

function KioskDashboard({ isDevice }: { isDevice: boolean }) {
  const household = useHousehold().data ?? DEFAULT_HOUSEHOLD_SETTINGS
  const { kiosk, timezone } = household
  const dashboard = useDashboard('family')
  useHome()
  const now = useNow(30_000)
  const soundUnlocked = useSoundState((s) => s.unlocked)
  const [wokenAt, setWokenAt] = useState(0)
  const startedAt = useRef(Date.now())

  const p = getZonedParts(now, timezone)
  const inNightWindow = isWithinDailyWindow(
    p.hour * 60 + p.minute,
    kiosk.nightStart,
    kiosk.nightEnd,
  )
  const night = inNightWindow && now - wokenAt > WAKE_FROM_NIGHT_MS

  useApplyAppearance(() => ({
    theme: night ? 'liquid-glass-dark' : kiosk.theme,
    wallpaper: kiosk.wallpaper,
    perf: false,
    refraction: false,
  }))
  useWakeLock(!night)

  // A long-running page slowly accumulates memory; reload once a night, which also applies updates.
  useEffect(() => {
    if (
      p.hour === NIGHTLY_RELOAD_HOUR &&
      p.minute === 0 &&
      Date.now() - startedAt.current > MIN_UPTIME_BEFORE_RELOAD_MS
    ) {
      reloadWithUpdate()
    }
  }, [p.hour, p.minute])

  return (
    <div className="min-h-dvh p-4 md:p-6">
      <header className="mb-4 flex items-end justify-between gap-4 px-1">
        <div>
          <p className="text-4xl font-semibold tracking-tight tabular-nums md:text-5xl">
            {formatTime(now, timezone)}
          </p>
          <p className="mt-1 text-fg-muted">
            {formatFullDate(now, timezone)}
            {lunarDate(now, timezone) ? ` · 农历${lunarDate(now, timezone)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!soundUnlocked ? (
            <Button onClick={() => void unlockSound()}>
              <Volume2 className="size-4" />
              点击启用提醒声音
            </Button>
          ) : null}
          {!isDevice ? (
            <Link to="/" className="text-sm text-fg-muted hover:text-fg">
              返回首页
            </Link>
          ) : null}
        </div>
      </header>
      {dashboard.data ? (
        <DashboardGrid
          layouts={dashboard.data.layouts}
          widgets={dashboard.data.widgets}
          editMode={false}
          readOnly
        />
      ) : (
        <FullScreenSpinner />
      )}
      {night ? (
        <NightOverlay
          mode={kiosk.nightMode}
          now={now}
          timeZone={timezone}
          onWake={() => setWokenAt(Date.now())}
        />
      ) : null}
      <DrawerHost />
      <ReminderHost mode="device" />
      <RealtimeBridge />
      <StatusBar showUpdate={false} />
    </div>
  )
}

function NightOverlay({
  mode,
  now,
  timeZone,
  onWake,
}: {
  mode: 'dim' | 'clock'
  now: number
  timeZone: string
  onWake: () => void
}) {
  if (mode === 'dim') {
    return (
      <button
        type="button"
        aria-label="唤醒屏幕"
        onClick={onWake}
        className="fixed inset-0 z-30 bg-black/70"
      />
    )
  }
  return (
    <button
      type="button"
      aria-label="唤醒屏幕"
      onClick={onWake}
      className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-black text-white/70"
    >
      <span className="text-[22vw] leading-none font-extralight tabular-nums md:text-[16vw]">
        {formatTime(now, timeZone)}
      </span>
      <span className="mt-4 text-xl text-white/40">{formatFullDate(now, timeZone)}</span>
    </button>
  )
}
