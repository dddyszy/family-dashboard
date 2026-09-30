import { useEffect, useState } from 'react'
import { browserCapabilities } from './browser-capabilities'

export type WakeLockStatus =
  | 'inactive'
  | 'requesting'
  | 'active'
  | 'released'
  | 'denied'
  | 'https-required'
  | 'unsupported'

/** The browser releases the lock when the page is hidden or power saving takes priority. */
export function useWakeLock(enabled: boolean): WakeLockStatus {
  const availability = browserCapabilities().wakeLock
  const [status, setStatus] = useState<WakeLockStatus>('inactive')

  useEffect(() => {
    if (!enabled || availability !== 'available') return
    let sentinel: WakeLockSentinel | null = null
    let disposed = false
    let requesting = false
    const request = async () => {
      if (requesting || (sentinel && !sentinel.released)) return
      if (document.visibilityState !== 'visible') {
        setStatus('released')
        return
      }
      requesting = true
      setStatus('requesting')
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (disposed) void lock.release().catch(() => {})
        else {
          sentinel = lock
          setStatus(lock.released ? 'released' : 'active')
          lock.addEventListener('release', () => {
            if (!disposed) setStatus('released')
          })
        }
      } catch {
        if (!disposed) setStatus('denied')
      } finally {
        requesting = false
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request()
    }
    void request()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => {})
    }
  }, [enabled, availability])

  if (!enabled) return 'inactive'
  return availability === 'available' ? status : availability
}
