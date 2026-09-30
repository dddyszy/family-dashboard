import { SHOPPING_CATEGORIES } from '@shared/constants'
import type { ShoppingItem } from '@shared/schemas/shopping'
import { ChevronDown, ShoppingBasket } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Spinner } from '@/components/button'
import { EmptyState } from '@/components/misc'
import { useClearChecked, useDeleteItem, useItems, useUpdateItem } from '../queries'
import { AddItemBar } from './add-item-bar'
import { ItemEditModal } from './item-edit-modal'
import { ItemRow } from './item-row'

function categoryOrder(category: string): number {
  const index = SHOPPING_CATEGORIES.indexOf(category as (typeof SHOPPING_CATEGORIES)[number])
  return index === -1 ? SHOPPING_CATEGORIES.length - 1.5 : index
}

export function groupByCategory(items: ShoppingItem[]): Array<[string, ShoppingItem[]]> {
  const groups = new Map<string, ShoppingItem[]>()
  for (const item of items) groups.set(item.category, [...(groups.get(item.category) ?? []), item])
  return [...groups].sort(([a], [b]) => categoryOrder(a) - categoryOrder(b))
}

export function ShoppingListView({
  listId,
  readOnly,
  compact,
}: {
  listId: string
  readOnly?: boolean
  compact?: boolean
}) {
  const { data: items, isPending } = useItems(listId)
  const update = useUpdateItem()
  const remove = useDeleteItem()
  const clear = useClearChecked(listId)
  const [editing, setEditing] = useState<ShoppingItem | null>(null)
  const [showChecked, setShowChecked] = useState(true)

  const { pendingGroups, checked } = useMemo(() => {
    const all = items ?? []
    return {
      pendingGroups: groupByCategory(all.filter((i) => !i.checked)),
      checked: all.filter((i) => i.checked).sort((a, b) => (b.checkedAt ?? 0) - (a.checkedAt ?? 0)),
    }
  }, [items])

  const row = (item: ShoppingItem) => (
    <ItemRow
      key={item.id}
      item={item}
      readOnly={readOnly}
      onToggle={() => update.mutate({ item, input: { checked: !item.checked } })}
      onEdit={() => setEditing(item)}
      onDelete={readOnly ? undefined : () => remove.mutate(item)}
    />
  )

  return (
    <div className="flex flex-col gap-4">
      {readOnly ? null : <AddItemBar listId={listId} showFrequent={!compact} />}
      {isPending && !items ? (
        <div className="flex justify-center py-8">
          <Spinner className="text-fg-subtle" />
        </div>
      ) : pendingGroups.length === 0 && checked.length === 0 ? (
        <EmptyState
          icon={ShoppingBasket}
          title="清单是空的"
          description="在上方输入框添加要买的东西"
        />
      ) : (
        <>
          {pendingGroups.length === 0 ? (
            <p className="py-4 text-center text-sm text-fg-muted">都买齐了</p>
          ) : null}
          {pendingGroups.map(([category, groupItems]) => (
            <section key={category}>
              <h3 className="mb-1.5 px-1 text-xs font-semibold text-fg-muted">
                {category} · {groupItems.length}
              </h3>
              <ul className="flex flex-col gap-1.5">{groupItems.map(row)}</ul>
            </section>
          ))}
          {checked.length > 0 ? (
            <section>
              <div className="mb-1.5 flex items-center justify-between px-1">
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs font-semibold text-fg-muted"
                  onClick={() => setShowChecked((v) => !v)}
                >
                  已购 · {checked.length}
                  <ChevronDown className={showChecked ? 'size-3.5' : 'size-3.5 -rotate-90'} />
                </button>
                {readOnly ? null : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => clear.mutate()}
                    loading={clear.isPending}
                  >
                    清除已购
                  </Button>
                )}
              </div>
              {showChecked ? <ul className="flex flex-col gap-1.5">{checked.map(row)}</ul> : null}
            </section>
          ) : null}
        </>
      )}
      {editing ? <ItemEditModal item={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  )
}
