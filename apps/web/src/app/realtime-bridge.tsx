import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { clearClientCaches } from '@/lib/query-client'
import { connectRealtime, disconnectRealtime, onReconnect, useRealtime } from '@/lib/realtime'
import { useMe } from '@/modules/auth/queries'
import { useCalendarRealtime } from '@/modules/calendar'
import { settingsKeys } from '@/modules/settings/queries'
import { useShoppingRealtime } from '@/modules/shopping'

/** Opens the shared SSE connection and maps server events onto cache updates. */
export function RealtimeBridge() {
  const qc = useQueryClient()
  const { data: me } = useMe()
  const identity =
    me?.kind === 'user'
      ? `user:${me.user.id}`
      : me?.kind === 'device'
        ? `device:${me.device.id}`
        : null

  useEffect(() => {
    if (!identity) return
    connectRealtime()
    const off = onReconnect(() => void qc.invalidateQueries())
    // The server binds a stream to whoever opened it; never let the next account inherit it.
    return () => {
      off()
      disconnectRealtime()
    }
  }, [qc, identity])

  useRealtime(
    'members.changed',
    () => void qc.invalidateQueries({ queryKey: settingsKeys.members }),
  )
  useRealtime(
    'settings.changed',
    () => void qc.invalidateQueries({ queryKey: settingsKeys.household }),
  )
  useRealtime('dashboard.changed', () => void qc.invalidateQueries({ queryKey: ['dashboard'] }))
  useRealtime('data.reset', ({ mode }) => {
    if (mode === 'content') {
      void qc.invalidateQueries()
      return
    }
    // Every account and device is gone: drop cached data and let the app route to setup/pairing.
    disconnectRealtime()
    void clearClientCaches().then(() => window.location.reload())
  })
  useShoppingRealtime()
  useCalendarRealtime()
  return null
}
