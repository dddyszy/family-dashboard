import { REALTIME_EVENT_NAMES, type RealtimeEventName, type RealtimeEvents } from '@shared/realtime'
import { useEffect, useRef } from 'react'
import { create } from 'zustand'

type Handler = (data: unknown) => void

export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'reconnecting'

export const useRealtimeStatus = create<{ status: RealtimeStatus }>(() => ({ status: 'idle' }))

const handlers = new Map<RealtimeEventName, Set<Handler>>()
const reconnectHandlers = new Set<() => void>()
let source: EventSource | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryDelay = 2000
let hasConnectedBefore = false

function setStatus(status: RealtimeStatus): void {
  useRealtimeStatus.setState({ status })
}

export function connectRealtime(): void {
  if (source) return
  setStatus(hasConnectedBefore ? 'reconnecting' : 'connecting')
  const es = new EventSource('/api/stream')
  source = es
  es.addEventListener('ready', () => {
    setStatus('open')
    retryDelay = 2000
    if (hasConnectedBefore) for (const fn of reconnectHandlers) fn()
    hasConnectedBefore = true
  })
  for (const name of REALTIME_EVENT_NAMES) {
    es.addEventListener(name, (event) => {
      let data: unknown
      try {
        data = JSON.parse((event as MessageEvent<string>).data)
      } catch {
        return
      }
      for (const fn of handlers.get(name) ?? []) fn(data)
    })
  }
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) {
      // The browser gave up (e.g. 401 or proxy error); retry ourselves with backoff.
      source = null
      setStatus('reconnecting')
      scheduleRetry()
    } else {
      setStatus('reconnecting')
    }
  }
}

function scheduleRetry(): void {
  if (retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    connectRealtime()
  }, retryDelay)
  retryDelay = Math.min(retryDelay * 2, 30_000)
}

export function disconnectRealtime(): void {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  source?.close()
  source = null
  hasConnectedBefore = false
  setStatus('idle')
}

export function subscribe<K extends RealtimeEventName>(
  name: K,
  handler: (data: RealtimeEvents[K]) => void,
): () => void {
  let set = handlers.get(name)
  if (!set) {
    set = new Set()
    handlers.set(name, set)
  }
  const fn = handler as Handler
  set.add(fn)
  return () => set.delete(fn)
}

export function onReconnect(handler: () => void): () => void {
  reconnectHandlers.add(handler)
  return () => reconnectHandlers.delete(handler)
}

export function useRealtime<K extends RealtimeEventName>(
  name: K,
  handler: (data: RealtimeEvents[K]) => void,
): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => subscribe(name, (data) => ref.current(data)), [name])
}
