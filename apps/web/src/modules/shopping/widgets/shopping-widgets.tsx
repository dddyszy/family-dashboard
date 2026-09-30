import type { ShoppingList } from '@shared/schemas/shopping'
import { ListChecks, ShoppingBasket, ShoppingCart } from 'lucide-react'
import { z } from 'zod'
import { Field, Select } from '@/components/form'
import { useHomeSlice } from '@/modules/home/queries'
import { FitList } from '@/widgets/fit-list'
import { useReadOnly } from '@/widgets/read-only'
import { type ConfigEditorProps, registerWidget, type WidgetProps } from '@/widgets/registry'
import { WidgetHeader } from '@/widgets/widget-frame'
import { formatQty } from '../components/item-row'
import { useLists, useUpdateItem } from '../queries'

const listConfig = z.object({ listId: z.string().nullable().default(null) })
type ListConfig = z.infer<typeof listConfig>

function useShoppingHome() {
  return useHomeSlice((d) => d.shopping).data
}

function pickList(lists: ShoppingList[], listId: string | null): ShoppingList | undefined {
  return lists.find((l) => l.id === listId) ?? lists[0]
}

function ListPicker({
  config,
  onChange,
  allowAll,
}: ConfigEditorProps<ListConfig> & { allowAll?: boolean }) {
  const { data: lists = [] } = useLists()
  return (
    <Field label="显示哪个清单">
      <Select
        value={config.listId ?? ''}
        onChange={(e) => onChange({ ...config, listId: e.target.value || null })}
      >
        <option value="">{allowAll ? '全部清单' : '第一个清单'}</option>
        {lists.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </Select>
    </Field>
  )
}

function PendingWidget({ size, config }: WidgetProps<ListConfig>) {
  const shopping = useShoppingHome()
  const readOnly = useReadOnly()
  const update = useUpdateItem()
  const list = shopping ? pickList(shopping.lists, config.listId) : undefined
  const items = list ? (shopping?.pendingItems[list.id] ?? []) : []
  const visible = items.slice(0, 40)

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <WidgetHeader
        icon={ShoppingCart}
        title={list?.name ?? '购物清单'}
        accent={list?.color}
        trailing={list ? `${list.pendingCount} 件` : undefined}
      />
      {!list ? (
        <p className="m-auto text-sm text-fg-muted">还没有购物清单</p>
      ) : visible.length === 0 ? (
        <p className="m-auto text-sm text-fg-muted">都买齐了</p>
      ) : (
        <FitList columns={size === 'M' ? 2 : 1} className="gap-y-1.5">
          {visible.map((item) => (
            <li key={item.id} className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                disabled={readOnly}
                onClick={(e) => {
                  e.stopPropagation()
                  update.mutate({ item, input: { checked: true } })
                }}
                className="no-drag size-4.5 shrink-0 rounded-full border-2 border-fg-subtle hover:border-success disabled:hover:border-fg-subtle"
                aria-label={`勾选${item.name}`}
              />
              <span className="truncate">{item.name}</span>
              {item.qty !== null ? (
                <span className="shrink-0 text-xs text-fg-subtle">{formatQty(item)}</span>
              ) : null}
            </li>
          ))}
        </FitList>
      )}
    </div>
  )
}

function CountWidget({ config }: WidgetProps<ListConfig>) {
  const shopping = useShoppingHome()
  const lists = shopping?.lists ?? []
  const list = config.listId ? lists.find((l) => l.id === config.listId) : undefined
  const count = list ? list.pendingCount : lists.reduce((sum, l) => sum + l.pendingCount, 0)
  return (
    <div className="flex h-full flex-col justify-between p-4">
      <WidgetHeader icon={ShoppingBasket} title={list?.name ?? '待买'} accent={list?.color} />
      <div>
        <p className="text-5xl font-semibold tabular-nums">{count}</p>
        <p className="text-sm text-fg-muted">{count > 0 ? '件待买' : '都买齐了'}</p>
      </div>
    </div>
  )
}

function OverviewWidget() {
  const shopping = useShoppingHome()
  const lists = shopping?.lists ?? []
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <WidgetHeader icon={ListChecks} title="购物清单" />
      {lists.length === 0 ? (
        <p className="m-auto text-sm text-fg-muted">还没有购物清单</p>
      ) : (
        <ul className="grid flex-1 grid-cols-2 content-start gap-2">
          {lists.slice(0, 6).map((l) => (
            <li key={l.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
              <span className="size-2.5 rounded-full" style={{ background: l.color }} />
              <span className="flex-1 truncate text-sm">{l.name}</span>
              <span className="text-sm font-semibold tabular-nums">{l.pendingCount}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

registerWidget({
  type: 'shopping.pending',
  title: '购物待买',
  description: '显示某个清单里还没买的东西，可直接勾选',
  group: '购物清单',
  icon: ShoppingCart,
  sizes: ['M', 'L', 'XL'],
  defaultSize: 'L',
  configSchema: listConfig,
  component: PendingWidget,
  ConfigEditor: (props) => <ListPicker {...props} />,
  drawer: 'shopping',
})

registerWidget({
  type: 'shopping.count',
  title: '待买数量',
  description: '所有清单或某个清单的待买件数',
  group: '购物清单',
  icon: ShoppingBasket,
  sizes: ['S'],
  defaultSize: 'S',
  configSchema: listConfig,
  component: CountWidget,
  ConfigEditor: (props) => <ListPicker {...props} allowAll />,
  drawer: 'shopping',
})

registerWidget({
  type: 'shopping.overview',
  title: '清单概览',
  description: '每个购物清单的待买数量',
  group: '购物清单',
  icon: ListChecks,
  sizes: ['M'],
  defaultSize: 'M',
  configSchema: z.object({}),
  component: OverviewWidget,
  drawer: 'shopping',
})
