import { RefreshCw, WifiOff } from 'lucide-react'
import { Glass } from '@/components/glass'
import { useRealtimeStatus } from '@/lib/realtime'
import { useOnline } from '@/lib/use-now'
import { usePwa } from '@/pwa/register'

/** Floating pills for offline state and pending app updates. */
export function StatusBar({ showUpdate = true }: { showUpdate?: boolean }) {
  const online = useOnline()
  const realtime = useRealtimeStatus((s) => s.status)
  const { needRefresh, update } = usePwa()

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex flex-col items-center gap-2 px-4 md:bottom-4">
      {!online ? (
        <Glass
          strong
          className="pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm"
        >
          <WifiOff className="size-4 text-warning" />
          离线中，显示的是最近一次的数据，暂时无法修改
        </Glass>
      ) : realtime === 'reconnecting' ? (
        <Glass
          strong
          className="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-fg-muted"
        >
          <RefreshCw className="size-4 animate-spin" />
          正在重新连接…
        </Glass>
      ) : null}
      {showUpdate && needRefresh ? (
        <Glass
          as="button"
          strong
          onClick={update}
          className="pressable pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm"
        >
          <RefreshCw className="size-4 text-accent" />
          有新版本，点击刷新
        </Glass>
      ) : null}
    </div>
  )
}
