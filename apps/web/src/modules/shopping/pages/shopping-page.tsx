import type { ShoppingList } from '@shared/schemas/shopping'
import { ChevronLeft, Lock, Pencil, Plus, ShoppingCart, Store } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'wouter'
import { Button, Spinner } from '@/components/button'
import { Glass } from '@/components/glass'
import { EmptyState, PageHeader } from '@/components/misc'
import { cn } from '@/lib/cn'
import { useCurrentUser } from '@/modules/auth/queries'
import { ListEditorModal } from '../components/list-editor-modal'
import { ListIcon } from '../components/list-icon'
import { ShoppingListView } from '../components/list-view'
import { SupermarketMode } from '../components/supermarket-mode'
import { useLists } from '../queries'

export function ShoppingPage() {
  const { listId } = useParams<{ listId?: string }>()
  const [, navigate] = useLocation()
  const user = useCurrentUser()
  const { data: lists = [], isPending } = useLists()
  const [editor, setEditor] = useState<{ list?: ShoppingList } | null>(null)
  const [supermarket, setSupermarket] = useState(false)

  const selected = lists.find((l) => l.id === listId) ?? (listId ? undefined : lists[0])
  const isOwner = (list?: ShoppingList) => !list || list.ownerId === user?.id

  const listCards = (
    <div className="flex flex-col gap-2">
      {lists.map((list) => (
        <Link
          key={list.id}
          to={`/shopping/${list.id}`}
          className={cn(
            'pressable flex items-center gap-3 rounded-2xl p-3 transition',
            selected?.id === list.id ? 'bg-surface-strong shadow-sm' : 'hover:bg-surface',
          )}
        >
          <span
            className="inline-flex size-10 items-center justify-center rounded-xl text-white"
            style={{ background: list.color }}
          >
            <ListIcon name={list.icon} className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 font-medium">
              <span className="truncate">{list.name}</span>
              {list.visibility === 'private' ? <Lock className="size-3 text-fg-subtle" /> : null}
            </span>
            <span className="text-sm text-fg-muted">
              {list.pendingCount > 0 ? `${list.pendingCount} 件待买` : '已买齐'}
            </span>
          </span>
        </Link>
      ))}
      <Button variant="ghost" className="justify-start" onClick={() => setEditor({})}>
        <Plus className="size-4" />
        新建清单
      </Button>
    </div>
  )

  if (isPending && lists.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-6 text-fg-subtle" />
      </div>
    )
  }

  if (lists.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="购物清单" />
        <Glass className="p-6">
          <EmptyState
            icon={ShoppingCart}
            title="还没有购物清单"
            description="建一个「超市」清单，全家都能往里加东西"
            action={
              <Button variant="primary" onClick={() => setEditor({})}>
                新建清单
              </Button>
            }
          />
        </Glass>
        {editor ? (
          <ListEditorModal
            canChangeVisibility
            onClose={() => setEditor(null)}
            onCreated={(list) => navigate(`/shopping/${list.id}`)}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className={cn(listId && 'hidden md:block')}>
        <PageHeader title="购物清单" />
      </div>
      <div className="grid gap-5 md:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
        <Glass className={cn('h-fit p-3', listId && 'hidden md:block')}>{listCards}</Glass>
        {selected ? (
          <Glass className={cn('min-w-0 p-4 md:p-5', !listId && 'hidden md:block')}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Link
                to="/shopping"
                className="rounded-full p-1.5 hover:bg-surface md:hidden"
                aria-label="返回"
              >
                <ChevronLeft className="size-5" />
              </Link>
              <h2 className="min-w-0 flex-1 truncate text-xl font-bold">{selected.name}</h2>
              <Button size="sm" onClick={() => setSupermarket(true)}>
                <Store className="size-4" />
                超市模式
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setEditor({ list: selected })}
                aria-label="编辑清单"
              >
                <Pencil className="size-4" />
              </Button>
            </div>
            <ShoppingListView listId={selected.id} />
          </Glass>
        ) : null}
      </div>
      {editor ? (
        <ListEditorModal
          list={editor.list}
          canChangeVisibility={isOwner(editor.list)}
          onClose={() => setEditor(null)}
          onCreated={(list) => navigate(`/shopping/${list.id}`)}
          onDeleted={() => navigate('/shopping')}
        />
      ) : null}
      {supermarket && selected ? (
        <SupermarketMode list={selected} onClose={() => setSupermarket(false)} />
      ) : null}
    </div>
  )
}
