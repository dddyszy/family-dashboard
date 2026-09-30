import { MEMBER_COLORS } from '@shared/constants'
import { Check } from 'lucide-react'

export function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {MEMBER_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="pressable inline-flex size-9 items-center justify-center rounded-full ring-2 ring-white/40"
          style={{ background: color }}
          aria-label={color}
          aria-pressed={value === color}
        >
          {value === color ? <Check className="size-4 text-white" /> : null}
        </button>
      ))}
    </div>
  )
}
