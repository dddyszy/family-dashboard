import type { WakeLockStatus } from '@/lib/wake-lock'

const MESSAGES: Partial<Record<WakeLockStatus, string>> = {
  'https-required':
    '当前连接无法自动保持屏幕常亮。使用 HTTPS 后可在支持的浏览器中启用；也可以在设备系统设置中关闭自动锁屏。',
  unsupported: '当前浏览器不支持自动保持屏幕常亮，请在设备系统设置中关闭自动锁屏。',
  denied: '浏览器未允许保持屏幕常亮，请检查省电设置，或在设备系统设置中关闭自动锁屏。',
  released: '屏幕常亮已暂停；回到此页面后会尝试恢复，也可以在设备系统设置中关闭自动锁屏。',
}

export function WakeLockNotice({ status }: { status: WakeLockStatus }) {
  const message = MESSAGES[status]
  if (!message) return null
  return (
    <p role="status" className="mb-4 rounded-xl bg-surface px-4 py-3 text-sm text-fg-muted">
      {message}
    </p>
  )
}
