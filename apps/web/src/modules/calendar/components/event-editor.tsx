import type {
  EditScope,
  EventInstance,
  EventPatch,
  QuickEntryDraft,
} from '@shared/schemas/calendar'
import { addZonedDays, HOUR_MS } from '@shared/time'
import { MapPin, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/button'
import { Field, Input, Segmented, Switch, Textarea } from '@/components/form'
import { Modal } from '@/components/overlay'
import { toDateInput, toTimeInput } from '@/lib/time'
import { useCurrentUser } from '@/modules/auth/queries'
import { useTimeZone } from '@/modules/settings/queries'
import { fromInputs } from '../lib'
import { useCreateEvent, useDeleteEvent, useUpdateEvent } from '../queries'
import { MemberPicker, RecurrencePicker, ReminderPicker } from './pickers'
import { ScopeDialog } from './scope-dialog'

export type EditorTarget =
  | { kind: 'new'; draft?: Partial<QuickEntryDraft> & { startAt: number; endAt: number } }
  | { kind: 'edit'; instance: EventInstance }

type Form = {
  title: string
  allDay: boolean
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  location: string
  note: string
  participantIds: string[]
  visibility: 'family' | 'private'
  rrule: string | null
  remindOffsets: number[]
}

function initialForm(target: EditorTarget, timeZone: string, userId: string | undefined): Form {
  const source =
    target.kind === 'edit'
      ? target.instance
      : {
          title: target.draft?.title ?? '',
          allDay: target.draft?.allDay ?? false,
          startAt: target.draft?.startAt ?? Date.now(),
          endAt: target.draft?.endAt ?? Date.now() + HOUR_MS,
          location: null,
          note: null,
          participantIds: target.draft?.participantIds ?? (userId ? [userId] : []),
          visibility: 'family' as const,
          rrule: target.draft?.rrule ?? null,
          remindOffsets: target.draft?.remindOffsets ?? [15],
        }
  // All-day events store an exclusive end; the form shows the inclusive last day.
  const displayEnd = source.allDay ? addZonedDays(source.endAt, -1, timeZone) : source.endAt
  return {
    title: source.title,
    allDay: source.allDay,
    startDate: toDateInput(source.startAt, timeZone),
    startTime: toTimeInput(source.startAt, timeZone),
    endDate: toDateInput(Math.max(displayEnd, source.startAt), timeZone),
    endTime: toTimeInput(source.endAt, timeZone),
    location: source.location ?? '',
    note: source.note ?? '',
    participantIds: source.participantIds,
    visibility: source.visibility,
    rrule: source.rrule,
    remindOffsets: source.remindOffsets,
  }
}

export function EventEditor({ target, onClose }: { target: EditorTarget; onClose: () => void }) {
  const timeZone = useTimeZone()
  const user = useCurrentUser()
  const create = useCreateEvent()
  const update = useUpdateEvent()
  const remove = useDeleteEvent()
  const [form, setForm] = useState<Form>(() => initialForm(target, timeZone, user?.id))
  const [pendingScope, setPendingScope] = useState<'edit' | 'delete' | null>(null)
  const [error, setError] = useState('')

  const instance = target.kind === 'edit' ? target.instance : null
  const isRecurring = Boolean(instance?.rrule)
  const canChangeVisibility = !instance || instance.ownerId === user?.id

  const times = () => {
    if (form.allDay) {
      const startAt = fromInputs(form.startDate, '00:00', timeZone)
      const endAt = addZonedDays(fromInputs(form.endDate, '00:00', timeZone), 1, timeZone)
      return { startAt, endAt }
    }
    return {
      startAt: fromInputs(form.startDate, form.startTime, timeZone),
      endAt: fromInputs(form.endDate, form.endTime, timeZone),
    }
  }

  const buildPatch = (scope: EditScope): EventPatch => {
    let { startAt, endAt } = times()
    if (instance && isRecurring && scope === 'all') {
      // Times in the form refer to this occurrence; translate the change onto the series start.
      const shift = startAt - instance.startAt
      const duration = endAt - startAt
      startAt = instance.seriesStartAt + shift
      endAt = startAt + duration
    }
    return {
      title: form.title.trim(),
      allDay: form.allDay,
      startAt,
      endAt,
      location: form.location.trim() || null,
      note: form.note.trim() || null,
      participantIds: form.participantIds,
      rrule: form.rrule,
      remindOffsets: form.remindOffsets,
      ...(canChangeVisibility ? { visibility: form.visibility } : {}),
    }
  }

  const save = (scope: EditScope = 'all') => {
    const done = { onSuccess: onClose }
    if (!instance) {
      const { startAt, endAt } = times()
      create.mutate(
        {
          title: form.title.trim(),
          allDay: form.allDay,
          startAt,
          endAt,
          location: form.location.trim() || null,
          note: form.note.trim() || null,
          participantIds: form.participantIds,
          visibility: form.visibility,
          rrule: form.rrule,
          remindOffsets: form.remindOffsets,
        },
        done,
      )
      return
    }
    update.mutate(
      { id: instance.id, scope, occurrence: instance.occurrenceAt, patch: buildPatch(scope) },
      done,
    )
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const { startAt, endAt } = times()
    if (endAt < startAt) {
      setError('结束时间不能早于开始时间')
      return
    }
    setError('')
    if (isRecurring) setPendingScope('edit')
    else save()
  }

  const doDelete = (scope: EditScope) => {
    if (!instance) return
    remove.mutate(
      { id: instance.id, scope, occurrence: instance.occurrenceAt },
      { onSuccess: onClose },
    )
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  return (
    <>
      <Modal
        open
        onOpenChange={(open) => !open && onClose()}
        title={instance ? '编辑日程' : '新建日程'}
        className="sm:max-w-xl"
        footer={
          <>
            {instance ? (
              <Button
                variant="ghost"
                className="mr-auto text-danger"
                onClick={() => (isRecurring ? setPendingScope('delete') : doDelete('all'))}
                loading={remove.isPending}
              >
                <Trash2 className="size-4" />
                删除
              </Button>
            ) : null}
            <Button onClick={onClose}>取消</Button>
            <Button
              variant="primary"
              type="submit"
              form="event-form"
              loading={create.isPending || update.isPending}
            >
              保存
            </Button>
          </>
        }
      >
        <form id="event-form" className="flex flex-col gap-4" onSubmit={submit}>
          <Input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="标题"
            className="h-12 text-lg font-medium"
            required
            autoFocus={!instance}
          />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-fg-muted">全天</span>
            <Switch label="全天" checked={form.allDay} onChange={(v) => set('allDay', v)} />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => {
                const startDate = e.target.value
                setForm((f) => ({
                  ...f,
                  startDate,
                  endDate: f.endDate < startDate ? startDate : f.endDate,
                }))
              }}
              aria-label="开始日期"
              required
            />
            {form.allDay ? null : (
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => {
                  const startTime = e.target.value
                  setForm((f) => {
                    const oldStart = fromInputs(f.startDate, f.startTime, timeZone)
                    const oldEnd = fromInputs(f.endDate, f.endTime, timeZone)
                    const newStart = fromInputs(f.startDate, startTime, timeZone)
                    const newEnd = newStart + Math.max(0, oldEnd - oldStart)
                    return {
                      ...f,
                      startTime,
                      endDate: toDateInput(newEnd, timeZone),
                      endTime: toTimeInput(newEnd, timeZone),
                    }
                  })
                }}
                aria-label="开始时间"
                className="w-32"
                required
              />
            )}
            <Input
              type="date"
              value={form.endDate}
              min={form.startDate}
              onChange={(e) => set('endDate', e.target.value)}
              aria-label="结束日期"
              required
            />
            {form.allDay ? null : (
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => set('endTime', e.target.value)}
                aria-label="结束时间"
                className="w-32"
                required
              />
            )}
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="relative">
            <MapPin className="pointer-events-none absolute top-3 left-3 size-4 text-fg-subtle" />
            <Input
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="地点（可选）"
              className="pl-9"
            />
          </div>
          <Field label="参与成员">
            <MemberPicker
              value={form.participantIds}
              onChange={(ids) => set('participantIds', ids)}
            />
          </Field>
          <Field label="重复">
            <RecurrencePicker
              value={form.rrule}
              startAt={times().startAt}
              timeZone={timeZone}
              onChange={(rrule) => set('rrule', rrule)}
            />
          </Field>
          <Field label="提醒" hint="到时间后会在打开的页面和家庭大屏上弹出提醒">
            <ReminderPicker value={form.remindOffsets} onChange={(v) => set('remindOffsets', v)} />
          </Field>
          {canChangeVisibility ? (
            <Field label="谁能看到">
              <Segmented
                value={form.visibility}
                onChange={(v) => set('visibility', v)}
                options={[
                  { value: 'family', label: '全家' },
                  { value: 'private', label: '仅自己和参与成员' },
                ]}
              />
            </Field>
          ) : null}
          <Field label="备注">
            <Textarea value={form.note} onChange={(e) => set('note', e.target.value)} rows={2} />
          </Field>
        </form>
      </Modal>
      {pendingScope ? (
        <ScopeDialog
          action={pendingScope}
          onCancel={() => setPendingScope(null)}
          onChoose={(scope) => {
            const action = pendingScope
            setPendingScope(null)
            if (action === 'edit') save(scope)
            else doDelete(scope)
          }}
        />
      ) : null}
    </>
  )
}
