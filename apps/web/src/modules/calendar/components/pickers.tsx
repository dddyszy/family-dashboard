import { REMIND_PRESETS } from '@shared/constants'
import {
  buildPresetRrule,
  detectPreset,
  RECURRENCE_LABELS,
  RECURRENCE_PRESETS,
  type RecurrencePreset,
} from '@shared/recurrence'
import { useState } from 'react'
import { Chip, Input, Select } from '@/components/form'
import { Avatar } from '@/components/misc'
import { useMembers } from '@/modules/settings/queries'

export function MemberPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const { data: members = [] } = useMembers()
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((m) => {
        const selected = value.includes(m.id)
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={selected}
            onClick={() =>
              onChange(selected ? value.filter((id) => id !== m.id) : [...value, m.id])
            }
            className={
              selected
                ? 'pressable flex items-center gap-1.5 rounded-full bg-accent py-1 pr-3 pl-1 text-sm text-accent-fg'
                : 'pressable flex items-center gap-1.5 rounded-full bg-surface py-1 pr-3 pl-1 text-sm text-fg-muted'
            }
          >
            <Avatar user={m} size={24} />
            {m.name}
          </button>
        )
      })}
    </div>
  )
}

export function ReminderPicker({
  value,
  onChange,
}: {
  value: number[]
  onChange: (offsets: number[]) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {REMIND_PRESETS.map((preset) => {
        const selected = value.includes(preset.minutes)
        return (
          <Chip
            key={preset.minutes}
            selected={selected}
            onClick={() =>
              onChange(
                selected ? value.filter((m) => m !== preset.minutes) : [...value, preset.minutes],
              )
            }
          >
            {preset.label}
          </Chip>
        )
      })}
    </div>
  )
}

export function RecurrencePicker({
  value,
  startAt,
  timeZone,
  onChange,
}: {
  value: string | null
  startAt: number
  timeZone: string
  onChange: (rrule: string | null) => void
}) {
  const detected = detectPreset(value, startAt, timeZone)
  const [custom, setCustom] = useState(detected === 'custom')
  const preset: RecurrencePreset = custom ? 'custom' : detected

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={preset}
        onChange={(e) => {
          const next = e.target.value as RecurrencePreset
          if (next === 'custom') {
            setCustom(true)
            onChange(value ?? 'FREQ=WEEKLY')
          } else {
            setCustom(false)
            onChange(buildPresetRrule(next, startAt, timeZone))
          }
        }}
      >
        {RECURRENCE_PRESETS.map((p) => (
          <option key={p} value={p}>
            {RECURRENCE_LABELS[p]}
          </option>
        ))}
      </Select>
      {preset === 'custom' ? (
        <Input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value.trim().toUpperCase() || null)}
          placeholder="例如 FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE"
          className="font-mono text-sm"
        />
      ) : null}
    </div>
  )
}
