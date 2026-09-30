import { SHOPPING_CATEGORIES } from '@shared/constants'
import type { ShoppingItem } from '@shared/schemas/shopping'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/button'
import { Field, Input, Select } from '@/components/form'
import { Modal } from '@/components/overlay'
import { useUpdateItem } from '../queries'

export function ItemEditModal({ item, onClose }: { item: ShoppingItem; onClose: () => void }) {
  const update = useUpdateItem()
  const [form, setForm] = useState({
    name: item.name,
    qty: item.qty === null ? '' : String(item.qty),
    unit: item.unit ?? '',
    category: item.category,
    note: item.note ?? '',
  })
  const categories = SHOPPING_CATEGORIES.includes(
    item.category as (typeof SHOPPING_CATEGORIES)[number],
  )
    ? SHOPPING_CATEGORIES
    : [...SHOPPING_CATEGORIES, item.category]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const qty = form.qty.trim() ? Number(form.qty) : null
    update.mutate({
      item,
      input: {
        name: form.name.trim(),
        qty: qty !== null && Number.isFinite(qty) && qty > 0 ? qty : null,
        unit: form.unit.trim() || null,
        category: form.category,
        note: form.note.trim() || null,
      },
    })
    onClose()
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title="编辑商品">
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="名称">
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="数量">
            <Input
              inputMode="decimal"
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
            />
          </Field>
          <Field label="单位">
            <Input
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              maxLength={8}
            />
          </Field>
        </div>
        <Field label="分类" hint="修改后，下次添加同名商品会自动归到这个分类">
          <Select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="备注">
          <Input
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="例如：要低脂的"
          />
        </Field>
        <Button type="submit" variant="primary">
          保存
        </Button>
      </form>
    </Modal>
  )
}
