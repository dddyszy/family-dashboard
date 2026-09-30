import { registerSW } from 'virtual:pwa-register'
import { create } from 'zustand'
import { browserCapabilities } from '@/lib/browser-capabilities'

type PwaState = {
  needRefresh: boolean
  update: () => void
  status: 'idle' | 'registering' | 'ready' | 'error' | 'development'
}

export const usePwa = create<PwaState>(() => ({
  needRefresh: false,
  update: () => {},
  status: 'idle',
}))

export function registerPwa(): void {
  if (browserCapabilities().offline !== 'available') return
  if (import.meta.env.DEV) {
    usePwa.setState({ status: 'development' })
    return
  }
  usePwa.setState({ status: 'registering' })
  const updateSW = registerSW({
    onOfflineReady: () => usePwa.setState({ status: 'ready' }),
    onRegisterError: () => usePwa.setState({ status: 'error' }),
    onNeedRefresh: () => usePwa.setState({ needRefresh: true }),
    onRegisteredSW: (_url, registration) => {
      if (registration?.active) usePwa.setState({ status: 'ready' })
      // Long-running kiosks never navigate, so poll for new deployments hourly.
      if (registration)
        setInterval(() => void registration.update().catch(() => {}), 60 * 60 * 1000)
    },
  })
  usePwa.setState({ update: () => void updateSW(true) })
}

/** Applies a waiting update if there is one, otherwise just reloads. */
export function reloadWithUpdate(): void {
  const { needRefresh, update } = usePwa.getState()
  if (needRefresh) update()
  else window.location.reload()
}
