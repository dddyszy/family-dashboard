import type { ShoppingItem } from '@shared/schemas/shopping'
import { useQueryClient } from '@tanstack/react-query'
import { lazy } from 'react'
import { registerDrawer } from '@/app/drawers'
import { useRealtime } from '@/lib/realtime'
import { homeKeys } from '@/modules/home/queries'
import { applyItemChange, shoppingKeys } from './queries'
import './widgets/shopping-widgets'

registerDrawer({
  name: 'shopping',
  title: '购物清单',
  component: lazy(() =>
    import('./drawer/shopping-drawer').then((m) => ({ default: m.ShoppingDrawer })),
  ),
})

export function useShoppingRealtime(): void {
  const qc = useQueryClient()
  const upsert = ({ listId, item }: { listId: string; item: ShoppingItem }) =>
    applyItemChange(qc, listId, { type: 'upsert', item })

  useRealtime('shopping.item.created', upsert)
  useRealtime('shopping.item.updated', upsert)
  useRealtime('shopping.item.deleted', ({ listId, itemId }) =>
    applyItemChange(qc, listId, { type: 'remove', itemId }),
  )
  useRealtime('shopping.items.cleared', ({ listId }) => {
    void qc.invalidateQueries({ queryKey: shoppingKeys.items(listId) })
    void qc.invalidateQueries({ queryKey: shoppingKeys.lists })
    void qc.invalidateQueries({ queryKey: shoppingKeys.frequent })
    void qc.invalidateQueries({ queryKey: homeKeys.home })
  })
  useRealtime('shopping.list.changed', () => {
    void qc.invalidateQueries({ queryKey: shoppingKeys.all })
    void qc.invalidateQueries({ queryKey: homeKeys.home })
  })
}
