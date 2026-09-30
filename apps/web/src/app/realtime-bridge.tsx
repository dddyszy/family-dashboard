import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { connectRealtime, onReconnect, useRealtime } from '@/lib/realtime'
import { useCalendarRealtime } from '@/modules/calendar'
import { settingsKeys } from '@/modules/settings/queries'
import { useShoppingRealtime } from '@/modules/shopping'

/** Opens the shared SSE connection and maps server events onto cache updates. */
export function RealtimeBridge() {
  const qc = useQueryClient()

  useEffect(() => {
    connectRealtime()
    return onReconnect(() => void qc.invalidateQueries())
  }, [qc])

  useRealtime(
    'members.changed',
    () => void qc.invalidateQueries({ queryKey: settingsKeys.members }),
  )
  useRealtime(
    'settings.changed',
    () => void qc.invalidateQueries({ queryKey: settingsKeys.household }),
  )
  useRealtime('dashboard.changed', () => void qc.invalidateQueries({ queryKey: ['dashboard'] }))
  useShoppingRealtime()
  useCalendarRealtime()
  return null
}
