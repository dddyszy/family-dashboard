import {
  buildPresetRrule,
  detectPreset,
  RECURRENCE_LABELS,
  type RecurrencePreset,
} from '@shared/recurrence'
import { Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/button'
import { Field, Input, Segmented, Select, Textarea } from '@/components/form'
import { Modal } from '@/components/overlay'
import { toDateInput, toTimeInput } from '@/lib/time'
import { useCurrentUser } from '@/modules/auth/queries'
import { useTimeZone } from '@/modules/settings/queries'
import { fromInputs } from '../lib'
import { useCreateTodo, useDeleteTodo, useUpdateTodo } from '../queries'
import type { TodoEditorTarget } from '../store'
import { MemberPicker, ReminderPicker } from './pickers'

const TODO_PRESETS: RecurrencePreset[] = [
  'none',
  'daily',
  'weekdays',
  'weekly',
  'biweekly',
  'monthly',
  'yearly',
]

export function TodoEditor({ target, onClose }: { target: TodoEditorTarget; onClose: () => void }) {
  const timeZone = useTimeZone()
  const user = useCurrentUser()
  const create = useCreateTodo()
  const update = useUpdateTodo()
  const remove = useDeleteTodo()
  const todo = target.kind === 'edit' ? target.todo : null
  const [form, setForm] = useState({
    title: todo?.title ?? '',
    note: todo?.note ?? '',
    hasDue: todo ? todo.dueAt !== null : false,
    dueDate: toDateInput(todo?.dueAt ?? Date.now(), timeZone),
    dueTime: todo?.dueAt ? toTimeInput(todo.dueAt, timeZone) : '20:00',
    assigneeIds: todo?.assigneeIds ?? [],
    visibility: todo?.visibility ?? ('family' as const),
    preset: todo?.dueAt
      ? detectPreset(todo.rrule, todo.dueAt, timeZone)
      : ('none' as RecurrencePreset),
    remindOffsets: todo?.remindOffsets ?? [0],
  })
  const canChangeVisibility = !todo || todo.ownerId === user?.id

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const dueAt = form.hasDue ? fromInputs(form.dueDate, form.dueTime, timeZone) : null
    const rrule =
      dueAt !== null && form.preset !== 'custom'
        ? buildPresetRrule(form.preset, dueAt, timeZone)
        : (todo?.rrule ?? null)
    const payload = {
      title: form.title.trim(),
      note: form.note.trim() || null,
      dueAt,
      rrule: dueAt === null ? null : rrule,
      assigneeIds: form.assigneeIds,
      remindOffsets: dueAt === null ? [] : form.remindOffsets,
      ...(canChangeVisibility ? { visibility: form.visibility } : {}),
    }
    if (todo) update.mutate({ id: todo.id, patch: payload }, { onSuccess: onClose })
    else create.mutate({ visibility: 'family', ...payload }, { onSuccess: onClose })
  }

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={todo ? '编辑待办' : '新建待办'}
      footer={
        <>
          {todo ? (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={() => remove.mutate(todo.id, { onSuccess: onClose })}
            >
              <Trash2 className="size-4" />
              删除
            </Button>
          ) : null}
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            type="submit"
            form="todo-form"
            loading={create.isPending || update.isPending}
          >
            保存
          </Button>
        </>
      }
    >
      <form id="todo-form" className="flex flex-col gap-4" onSubmit={submit}>
        <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="要做什么？"
          className="h-12 text-lg font-medium"
          autoFocus={!todo}
          required
        />
        <Field label="截止时间">
          <Segmented
            value={form.hasDue ? 'yes' : 'no'}
            onChange={(v) => setForm({ ...form, hasDue: v === 'yes' })}
            options={[
              { value: 'no', label: '不设' },
              { value: 'yes', label: '设置' },
            ]}
          />
        </Field>
        {form.hasDue ? (
          <>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                aria-label="截止日期"
              />
              <Input
                type="time"
                value={form.dueTime}
                onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
                aria-label="截止时间"
                className="w-32"
              />
            </div>
            <Field label="重复" hint="完成后会自动顺延到下一次">
              <Select
                value={form.preset}
                onChange={(e) => setForm({ ...form, preset: e.target.value as RecurrencePreset })}
              >
                {[...TODO_PRESETS, ...(form.preset === 'custom' ? (['custom'] as const) : [])].map(
                  (p) => (
                    <option key={p} value={p}>
                      {RECURRENCE_LABELS[p]}
                    </option>
                  ),
                )}
              </Select>
            </Field>
            <Field label="提醒">
              <ReminderPicker
                value={form.remindOffsets}
                onChange={(v) => setForm({ ...form, remindOffsets: v })}
              />
            </Field>
          </>
        ) : null}
        <Field label="交给谁">
          <MemberPicker
            value={form.assigneeIds}
            onChange={(ids) => setForm({ ...form, assigneeIds: ids })}
          />
        </Field>
        {canChangeVisibility ? (
          <Field label="谁能看到">
            <Segmented
              value={form.visibility}
              onChange={(v) => setForm({ ...form, visibility: v })}
              options={[
                { value: 'family', label: '全家' },
                { value: 'private', label: '仅自己和负责人' },
              ]}
            />
          </Field>
        ) : null}
        <Field label="备注">
          <Textarea
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            rows={2}
          />
        </Field>
      </form>
    </Modal>
  )
}
