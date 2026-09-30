import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppRoutes } from '@/app/router'
import { ToastHost } from '@/components/toast-host'
import { setUnauthorizedHandler } from '@/lib/api'
import { PERSIST_BUSTER, PERSIST_MAX_AGE, persister, queryClient } from '@/lib/query-client'
import { installGestureUnlock } from '@/lib/sound'
import { authKeys } from '@/modules/auth/queries'
import { registerPwa } from '@/pwa/register'
import './index.css'

setUnauthorizedHandler(() => void queryClient.invalidateQueries({ queryKey: authKeys.me }))
installGestureUnlock()
registerPwa()

const root = document.getElementById('root')
if (!root) throw new Error('缺少 #root 容器')

createRoot(root).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: PERSIST_MAX_AGE, buster: PERSIST_BUSTER }}
      // Restored data renders instantly but may be arbitrarily old, so always revalidate it.
      onSuccess={() => void queryClient.invalidateQueries()}
    >
      <div className="wallpaper" aria-hidden />
      <AppRoutes />
      <ToastHost />
    </PersistQueryClientProvider>
  </StrictMode>,
)
