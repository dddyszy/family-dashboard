import { ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'wouter'
import { Select } from '@/components/form'
import { EmptyState } from '@/components/misc'
import { useUi } from '@/stores/ui'
import { ShoppingListView } from '../components/list-view'
import { useLists } from '../queries'

export function ShoppingDrawer({ props }: { props?: Record<string, unknown> }) {
  const { data: lists = [] } = useLists()
  const closeDrawer = useUi((s) => s.closeDrawer)
  const readOnly = props?.readOnly === true
  const initial = typeof props?.listId === 'string' ? props.listId : undefined
  const [listId, setListId] = useState<string | undefined>(initial)
  const current = lists.find((l) => l.id === listId) ?? lists[0]

  if (!current) return <EmptyState icon={ShoppingCart} title="还没有购物清单" />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Select
          value={current.id}
          onChange={(e) => setListId(e.target.value)}
          aria-label="选择清单"
        >
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}（{l.pendingCount}）
            </option>
          ))}
        </Select>
        {readOnly ? null : (
          <Link
            to={`/shopping/${current.id}`}
            onClick={closeDrawer}
            className="shrink-0 text-sm text-accent hover:underline"
          >
            完整页面
          </Link>
        )}
      </div>
      <ShoppingListView listId={current.id} readOnly={readOnly} compact />
    </div>
  )
}
