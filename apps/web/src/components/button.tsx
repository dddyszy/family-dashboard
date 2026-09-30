import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-110 shadow-sm',
  secondary: 'bg-surface text-fg hover:bg-surface-hover',
  ghost: 'text-fg hover:bg-surface',
  danger: 'bg-danger text-white hover:brightness-110',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
  icon: 'h-10 w-10 justify-center',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, className, disabled, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      className={cn(
        'pressable inline-flex shrink-0 items-center justify-center rounded-control font-medium transition-colors disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
})

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
      aria-hidden
    />
  )
}
