import type { ShoppingList } from '@shared/schemas/shopping'
import { Check, X } from 'lucide-react'
import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Glass } from '@/components/glass'
import { cn } from '@/lib/cn'
import { useWakeLock } from '@/lib/wake-lock'
import { useItems, useUpdateItem } from '../queries'
import { formatQty } from './item-row'
import { groupByCategory } from './list-view'

/** Full-screen, large-type checklist for use while walking the aisles. Keeps the screen awake. */
export function SupermarketMode({ list, onClose }: { list: ShoppingList; onClose: () => void }) {
  useWakeLock(true)
  const { data: items = [] } = useItems(list.id)
  const update = useUpdateItem()

  const { groups, done } = useMemo(
    () => ({
      groups: groupByCategory(items.filter((i) => !i.checked)),
      done: items.filter((i) => i.checked),
    }),
    [items],
  )
  const remaining = items.length - done.length

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col animate-fade-in">
      <Glass strong className="safe-top flex h-full flex-col rounded-none">
        <header className="flex items-center justify-between px-5 py-4">
          <div>
            <h2 className="text-2xl font-bold">{list.name}</h2>
            <p className="text-fg-muted">还剩 {remaining} 件</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-surface p-3"
            aria-label="退出超市模式"
          >
            <X className="size-6" />
          </button>
        </header>
        <div className="safe-bottom flex-1 overflow-y-auto px-4 pb-8">
          {groups.map(([category, groupItems]) => (
            <section key={category} className="mb-5">
              <h3 className="mb-2 px-1 text-sm font-semibold text-fg-muted">{category}</h3>
              <ul className="flex flex-col gap-2">
                {groupItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => update.mutate({ item, input: { checked: true } })}
                      className="pressable flex min-h-16 w-full items-center gap-4 rounded-2xl bg-surface px-4 text-left text-2xl"
                    >
                      <span className="size-8 shrink-0 rounded-full border-[3px] border-fg-subtle" />
                      <span className="flex-1">{item.name}</span>
                      <span className="text-lg text-fg-muted">{formatQty(item)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {done.length > 0 ? (
            <section>
              <h3 className="mb-2 px-1 text-sm font-semibold text-fg-muted">已放进购物车</h3>
              <ul className="flex flex-col gap-2">
                {done.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => update.mutate({ item, input: { checked: false } })}
                      className={cn(
                        'pressable flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left text-xl text-fg-subtle',
                      )}
                    >
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-success text-white">
                        <Check className="size-5" strokeWidth={3} />
                      </span>
                      <span className="flex-1 line-through">{item.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </Glass>
    </div>,
    document.body,
  )
}
