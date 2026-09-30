import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Glass } from './glass'

type OverlayProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

/** Centered modal dialog. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: OverlayProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay animate-fade-in" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-end justify-center p-0 outline-none sm:items-center sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false)
          }}
        >
          <Glass
            strong
            className={cn(
              'safe-bottom flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-none animate-slide-up sm:max-w-lg sm:rounded-b-[var(--radius-card)]',
              className,
            )}
          >
            <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
              <div>
                <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-1 text-sm text-fg-muted">
                    {description}
                  </Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">{title}</Dialog.Description>
                )}
              </div>
              <Dialog.Close
                className="rounded-full p-1.5 text-fg-muted hover:bg-surface"
                aria-label="关闭"
              >
                <X className="size-5" />
              </Dialog.Close>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">{children}</div>
            {footer ? (
              <footer className="flex justify-end gap-2 border-t border-line px-6 py-4">
                {footer}
              </footer>
            ) : null}
          </Glass>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Right-hand drawer on wide screens, full-height sheet on phones. */
export function Drawer({ open, onOpenChange, title, children, footer }: OverlayProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay animate-fade-in" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full outline-none sm:w-[440px] sm:p-3">
          <Glass
            strong
            refract
            className="safe-top safe-bottom flex w-full flex-col overflow-hidden rounded-none animate-slide-in-right sm:rounded-[var(--radius-card)]"
          >
            <header className="flex items-center justify-between gap-4 px-5 pt-4 pb-3">
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              <Dialog.Description className="sr-only">{title}</Dialog.Description>
              <Dialog.Close
                className="rounded-full p-1.5 text-fg-muted hover:bg-surface"
                aria-label="关闭"
              >
                <X className="size-5" />
              </Dialog.Close>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
            {footer ? <footer className="border-t border-line px-5 py-3">{footer}</footer> : null}
          </Glass>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  actions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  actions: ReactNode
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex flex-col gap-2 pt-2">{actions}</div>
    </Modal>
  )
}
