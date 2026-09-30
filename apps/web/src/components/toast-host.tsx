import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useToasts } from '@/stores/ui'
import { Glass } from './glass'

const icons = { info: Info, success: CircleCheck, error: CircleAlert }
const tones = { info: 'text-accent', success: 'text-success', error: 'text-danger' }

export function ToastHost() {
  const { toasts, dismiss } = useToasts()
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-4 safe-top">
      {toasts.map((t) => {
        const Icon = icons[t.tone]
        return (
          <Glass
            key={t.id}
            strong
            role="status"
            onClick={() => dismiss(t.id)}
            className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full px-4 py-2.5 text-sm shadow-lg animate-pop-in"
          >
            <Icon className={cn('size-4 shrink-0', tones[t.tone])} />
            <span>{t.message}</span>
          </Glass>
        )
      })}
    </div>
  )
}
