import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'

const controlClass =
  'w-full rounded-control bg-surface px-3 text-fg placeholder:text-fg-subtle outline-none ring-1 ring-line transition focus:ring-2 focus:ring-accent disabled:opacity-60'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(controlClass, 'h-10', className)} {...rest} />
  },
)

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(controlClass, 'min-h-20 py-2', className)} {...rest} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...rest }, ref) {
    return <select ref={ref} className={cn(controlClass, 'h-10 pr-8', className)} {...rest} />
  },
)

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed as children
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-sm font-medium text-fg-muted">{label}</span>
      {children}
      {hint ? <span className="text-xs text-fg-subtle">{hint}</span> : null}
    </label>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-success' : 'bg-surface-strong',
      )}
    >
      <span
        className={cn(
          'inline-block size-6 rounded-full bg-white shadow transition-transform duration-300 ease-spring',
          checked ? 'translate-x-5.5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: ReadonlyArray<{ value: T; label: ReactNode }>
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-control bg-surface p-1', className)} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-[calc(var(--radius-control)-4px)] px-3 py-1.5 text-sm font-medium transition',
            option.value === value
              ? 'bg-surface-strong text-fg shadow-sm'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({
  selected,
  onClick,
  children,
  color,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  color?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'pressable inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm transition',
        selected ? 'bg-accent text-accent-fg' : 'bg-surface text-fg-muted hover:text-fg',
      )}
    >
      {color ? <span className="size-2.5 rounded-full" style={{ background: color }} /> : null}
      {children}
    </button>
  )
}
