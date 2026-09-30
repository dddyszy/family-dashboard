import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { navigateFallbackDenylist, runtimeCaching } from './src/pwa/cache-rules.ts'

const backend = 'http://localhost:8080'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: '家庭看板',
        short_name: '看板',
        description: '全家共用的日程、购物清单与信息大屏',
        lang: 'zh-CN',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#101624',
        theme_color: '#1c2a4a',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: '大屏模式',
            url: '/kiosk',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: '购物清单',
            url: '/shopping',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist,
        runtimeCaching,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? new Date().toISOString()),
  },
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: backend },
      '/uploads': { target: backend },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
})
