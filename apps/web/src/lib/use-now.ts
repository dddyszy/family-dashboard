import { useEffect, useState } from 'react'

/** Current time, re-rendering on each boundary of `intervalMs` (aligned, so clocks tick together). */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const current = Date.now()
      setNow(current)
      timer = setTimeout(tick, intervalMs - (current % intervalMs) + 5)
    }
    timer = setTimeout(tick, intervalMs - (Date.now() % intervalMs) + 5)
    return () => clearTimeout(timer)
  }, [intervalMs])
  return now
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
