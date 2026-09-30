import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import { del, get, set } from 'idb-keyval'
import { API_CACHE_NAME } from '@/pwa/cache-rules'
import { ApiError } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 7 * 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: (count, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
        return count < 2
      },
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'always' },
  },
})

const PERSIST_KEY = 'fd-query-cache'

export const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get<string>(key).then((v) => v ?? null),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
  key: PERSIST_KEY,
  throttleTime: 2000,
})

export const PERSIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000
export const PERSIST_BUSTER = __APP_VERSION__

/** Drops every cached response so the next person on this device sees nothing of the last. */
export async function clearClientCaches(): Promise<void> {
  queryClient.clear()
  await del(PERSIST_KEY)
  if ('caches' in window) await caches.delete(API_CACHE_NAME)
}
