import type { ShoppingItem } from '@shared/schemas/shopping'
import { Check, Pencil, Trash2 } from 'lucide-react'
import { type PointerEvent, useRef, useState } from 'react'
import { Avatar } from '@/components/misc'
import { cn } from '@/lib/cn'
import { useMemberMap } from '@/modules/settings/queries'

export function formatQty(item: Pick<ShoppingItem, 'qty' | 'unit'>): string {
  if (item.qty === null) return item.unit ?? ''
  return `${item.qty}${item.unit ?? ''}`
}

const SWIPE_REVEAL = 80

export function ItemRow({
  item,
  readOnly,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: ShoppingItem
  readOnly?: boolean
  onToggle: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const members = useMemberMap()
  const addedBy = members.get(item.addedBy)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; offset: number } | null>(null)
  const pending = item.id.startsWith('temp-')

  const onPointerDown = (e: PointerEvent) => {
    if (readOnly || !onDelete || e.pointerType === 'mouse') return
    start.current = { x: e.clientX, y: e.clientY, offset }
    setDragging(true)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    if (Math.abs(e.clientY - start.current.y) > Math.abs(dx)) return
    setOffset(Math.min(0, Math.max(-SWIPE_REVEAL * 1.4, start.current.offset + dx)))
  }
  const onPointerUp = () => {
    if (!start.current) return
    start.current = null
    setDragging(false)
    setOffset((o) => (o < -SWIPE_REVEAL / 2 ? -SWIPE_REVEAL : 0))
  }

  return (
    <li className="relative overflow-hidden rounded-2xl">
      {/* Rendered only while swiping: the glass row above is translucent and would let it show. */}
      {onDelete && (offset < 0 || dragging) ? (
        <button
          type="button"
          onClick={onDelete}
          className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-danger text-white"
          aria-label={`删除${item.name}`}
        >
          <Trash2 className="size-5" />
        </button>
      ) : null}
      <div
        className={cn(
          'group relative flex touch-pan-y items-center gap-3 bg-surface px-3 py-2.5 transition-transform',
          dragging ? 'duration-0' : 'duration-300 ease-spring',
          pending && 'opacity-60',
        )}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (!readOnly) onToggle()
          }}
          disabled={readOnly}
          aria-label={item.checked ? `取消勾选${item.name}` : `勾选${item.name}`}
          className={cn(
            'pressable inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition',
            item.checked ? 'border-success bg-success text-white' : 'border-fg-subtle',
          )}
        >
          {item.checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn('truncate', item.checked && 'text-fg-subtle line-through')}>
            {item.name}
            {item.qty !== null || item.unit ? (
              <span className="ml-2 text-sm text-fg-muted">{formatQty(item)}</span>
            ) : null}
          </p>
          {item.note ? <p className="truncate text-xs text-fg-subtle">{item.note}</p> : null}
        </div>
        {addedBy ? <Avatar user={addedBy} size={20} className="opacity-80" /> : null}
        {!readOnly && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full p-1.5 text-fg-subtle hover:bg-surface-hover hover:text-fg md:opacity-0 md:group-hover:opacity-100"
            aria-label={`编辑${item.name}`}
          >
            <Pencil className="size-4" />
          </button>
        ) : null}
        {!readOnly && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="hidden rounded-full p-1.5 text-fg-subtle hover:bg-surface-hover hover:text-danger md:block md:opacity-0 md:group-hover:opacity-100"
            aria-label={`删除${item.name}`}
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
    </li>
  )
}
