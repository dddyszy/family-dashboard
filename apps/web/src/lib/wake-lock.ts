import { useEffect } from 'react'

/** Keeps the screen on while `enabled`. The browser drops the lock whenever the page is hidden. */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let disposed = false
    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (disposed) void lock.release()
        else sentinel = lock
      } catch {
        // Denied (e.g. insecure context or battery saver); nothing else to do.
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
      void sentinel?.release()
    }
  }, [enabled])
}
