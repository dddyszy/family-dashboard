import type { VitePWAOptions } from 'vite-plugin-pwa'

type RuntimeCaching = NonNullable<NonNullable<VitePWAOptions['workbox']>['runtimeCaching']>

export const API_CACHE_NAME = 'fd-api'

/**
 * Workbox serialises each `urlPattern` into the service worker, so the matchers must stay
 * self-contained (no references to outer variables). First match wins.
 */
export const runtimeCaching: RuntimeCaching = [
  {
    urlPattern: ({ url }) =>
      url.pathname === '/api/stream' ||
      url.pathname === '/api/me' ||
      url.pathname.startsWith('/api/auth/') ||
      url.pathname.startsWith('/api/backups') ||
      url.pathname === '/api/export',
    handler: 'NetworkOnly',
  },
  {
    urlPattern: ({ url }) => url.pathname === '/api/weather',
    handler: 'StaleWhileRevalidate',
    options: { cacheName: 'fd-weather', expiration: { maxEntries: 4, maxAgeSeconds: 86400 } },
  },
  {
    urlPattern: ({ url }) => url.pathname.startsWith('/uploads/'),
    handler: 'StaleWhileRevalidate',
    options: { cacheName: 'fd-uploads', expiration: { maxEntries: 100 } },
  },
  {
    urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
    handler: 'NetworkFirst',
    options: {
      cacheName: 'fd-api',
      networkTimeoutSeconds: 3,
      expiration: { maxEntries: 300, maxAgeSeconds: 7 * 86400 },
    },
  },
]

export const navigateFallbackDenylist = [/^\/api\//, /^\/uploads\//]
