import { MEMBER_COLORS } from '@shared/constants'
import type { ShoppingList } from '@shared/schemas/shopping'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/button'
import { Field, Input, Segmented } from '@/components/form'
import { Modal } from '@/components/overlay'
import { errorMessage } from '@/lib/api'
import { ColorPicker } from '@/modules/settings/components/color-picker'
import { toast } from '@/stores/ui'
import { useCreateList, useDeleteList, useUpdateList } from '../queries'
import { LIST_ICONS, ListIcon } from './list-icon'

export function ListEditorModal({
  list,
  canChangeVisibility,
  onClose,
  onCreated,
  onDeleted,
}: {
  list?: ShoppingList
  canChangeVisibility: boolean
  onClose: () => void
  onCreated?: (list: ShoppingList) => void
  onDeleted?: () => void
}) {
  const create = useCreateList()
  const update = useUpdateList()
  const remove = useDeleteList()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState({
    name: list?.name ?? '',
    icon: list?.icon ?? 'shopping-cart',
    color: list?.color ?? MEMBER_COLORS[2],
    visibility: list?.visibility ?? ('family' as const),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const onError = (err: unknown) => toast.error(errorMessage(err))
    if (list) {
      const input = canChangeVisibility
        ? form
        : { name: form.name, icon: form.icon, color: form.color }
      update.mutate({ id: list.id, input }, { onSuccess: onClose, onError })
    } else {
      create.mutate(form, {
        onSuccess: (created) => {
          onCreated?.(created)
          onClose()
        },
        onError,
      })
    }
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={list ? '编辑清单' : '新建清单'}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="名称">
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="例如：超市、药店"
            maxLength={32}
            required
          />
        </Field>
        <Field label="图标">
          <div className="flex flex-wrap gap-2">
            {LIST_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => setForm({ ...form, icon })}
                aria-pressed={form.icon === icon}
                className={
                  form.icon === icon
                    ? 'rounded-xl bg-accent p-2 text-accent-fg'
                    : 'rounded-xl bg-surface p-2 text-fg-muted hover:text-fg'
                }
              >
                <ListIcon name={icon} className="size-5" />
              </button>
            ))}
          </div>
        </Field>
        <Field label="颜色">
          <ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} />
        </Field>
        {canChangeVisibility ? (
          <Field label="共享范围">
            <Segmented
              value={form.visibility}
              onChange={(visibility) => setForm({ ...form, visibility })}
              options={[
                { value: 'family', label: '全家共享' },
                { value: 'private', label: '仅自己' },
              ]}
            />
          </Field>
        ) : null}
        <Button type="submit" variant="primary" loading={create.isPending || update.isPending}>
          {list ? '保存' : '创建'}
        </Button>
        {list ? (
          confirmDelete ? (
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(list.id, {
                  onSuccess: () => {
                    onDeleted?.()
                    onClose()
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              确认删除清单及其中所有商品
            </Button>
          ) : (
            <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
              删除清单
            </Button>
          )
        ) : null}
      </form>
    </Modal>
  )
}
