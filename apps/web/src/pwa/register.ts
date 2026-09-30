import { registerSW } from 'virtual:pwa-register'
import { create } from 'zustand'

type PwaState = { needRefresh: boolean; update: () => void }

export const usePwa = create<PwaState>(() => ({ needRefresh: false, update: () => {} }))

export function registerPwa(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  const updateSW = registerSW({
    onNeedRefresh: () => usePwa.setState({ needRefresh: true }),
    onRegisteredSW: (_url, registration) => {
      // Long-running kiosks never navigate, so poll for new deployments hourly.
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000)
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
