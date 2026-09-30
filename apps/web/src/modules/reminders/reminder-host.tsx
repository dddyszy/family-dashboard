import type { Reminder } from '@shared/schemas/reminders'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlarmClock, BellRing, MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/button'
import { Glass } from '@/components/glass'
import { errorMessage } from '@/lib/api'
import { onReconnect, useRealtime } from '@/lib/realtime'
import { playChime } from '@/lib/sound'
import { formatTime, relativeDayLabel } from '@/lib/time'
import { useNow } from '@/lib/use-now'
import { calendarApi } from '@/modules/calendar/api'
import { useTimeZone } from '@/modules/settings/queries'
import { toast } from '@/stores/ui'

const activeKey = ['reminders', 'active'] as const
const DEVICE_DISMISSED_KEY = 'fd-kiosk-dismissed'
const MAX_VISIBLE = 3

function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DEVICE_DISMISSED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function saveDismissed(ids: Set<string>): void {
  localStorage.setItem(DEVICE_DISMISSED_KEY, JSON.stringify([...ids].slice(-200)))
}

/**
 * Shows fired reminders as stacked cards with a chime. Users act on their own reminders; kiosk
 * devices receive family reminders and can only hide them locally.
 */
export function ReminderHost({ mode = 'user' }: { mode?: 'user' | 'device' }) {
  const qc = useQueryClient()
  const isUser = mode === 'user'
  const active = useQuery({
    queryKey: activeKey,
    queryFn: calendarApi.activeReminders,
    enabled: isUser,
  })
  const [deviceReminders, setDeviceReminders] = useState<Reminder[]>([])

  useEffect(() => {
    if (!isUser) return
    return onReconnect(() => void qc.invalidateQueries({ queryKey: activeKey }))
  }, [isUser, qc])

  useRealtime('reminder.fired', ({ reminder }) => {
    playChime()
    if (isUser) {
      qc.setQueryData<Reminder[]>(activeKey, (list = []) => [
        reminder,
        ...list.filter((r) => r.id !== reminder.id),
      ])
    } else if (!loadDismissed().has(reminder.id)) {
      setDeviceReminders((list) =>
        [reminder, ...list.filter((r) => r.id !== reminder.id)].slice(0, 10),
      )
    }
  })

  const removeLocal = (id: string) =>
    qc.setQueryData<Reminder[]>(activeKey, (list = []) => list.filter((r) => r.id !== id))

  const dismiss = (reminder: Reminder) => {
    if (!isUser) {
      const ids = loadDismissed()
      ids.add(reminder.id)
      saveDismissed(ids)
      setDeviceReminders((list) => list.filter((r) => r.id !== reminder.id))
      return
    }
    removeLocal(reminder.id)
    calendarApi.dismissReminder(reminder.id).catch((err) => toast.error(errorMessage(err)))
  }

  const snooze = (reminder: Reminder) => {
    removeLocal(reminder.id)
    calendarApi
      .snoozeReminder(reminder.id)
      .then(() => toast.info('10 分钟后再提醒你'))
      .catch((err) => toast.error(errorMessage(err)))
  }

  const reminders = isUser ? (active.data ?? []) : deviceReminders
  if (reminders.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex flex-col items-center gap-2 px-4 md:right-6 md:bottom-6 md:left-auto md:items-end">
      {reminders.slice(0, MAX_VISIBLE).map((reminder) => (
        <ReminderCard
          key={reminder.id}
          reminder={reminder}
          onDismiss={() => dismiss(reminder)}
          onSnooze={isUser ? () => snooze(reminder) : undefined}
        />
      ))}
      {reminders.length > MAX_VISIBLE ? (
        <Glass strong className="pointer-events-auto rounded-full px-3 py-1 text-xs text-fg-muted">
          还有 {reminders.length - MAX_VISIBLE} 条提醒
        </Glass>
      ) : null}
    </div>
  )
}

function ReminderCard({
  reminder,
  onDismiss,
  onSnooze,
}: {
  reminder: Reminder
  onDismiss: () => void
  onSnooze?: () => void
}) {
  const timeZone = useTimeZone()
  const now = useNow(30_000)
  const { payload } = reminder
  const when = payload.allDay
    ? `${relativeDayLabel(payload.startAt, now, timeZone)} 全天`
    : payload.startAt <= now
      ? `${formatTime(payload.startAt, timeZone)} 已开始`
      : `${relativeDayLabel(payload.startAt, now, timeZone)} ${formatTime(payload.startAt, timeZone)} 开始`

  return (
    <Glass
      strong
      refract
      role="alert"
      className="pointer-events-auto w-full max-w-sm p-4 shadow-2xl animate-pop-in"
    >
      <div className="flex gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-warning/20 text-warning">
          <BellRing className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{payload.title}</p>
          <p className="text-sm text-fg-muted">{when}</p>
          {payload.location ? (
            <p className="flex items-center gap-1 truncate text-sm text-fg-muted">
              <MapPin className="size-3.5" />
              {payload.location}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {onSnooze ? (
          <Button size="sm" variant="ghost" onClick={onSnooze}>
            <AlarmClock className="size-4" />
            稍后 10 分钟
          </Button>
        ) : null}
        <Button size="sm" variant="primary" onClick={onDismiss}>
          知道了
        </Button>
      </div>
    </Glass>
  )
}
