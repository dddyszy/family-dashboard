import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { cn } from '@/lib/cn'

type GlassProps<T extends ElementType> = {
  as?: T
  /** More opaque surface for panels that carry dense content (drawers, dialogs). */
  strong?: boolean
  /** Opt into the SVG refraction filter when the user enabled it (Chromium only). */
  refract?: boolean
} & Omit<ComponentPropsWithoutRef<T>, 'as'>

export function Glass<T extends ElementType = 'div'>({
  as,
  strong,
  refract,
  className,
  ...rest
}: GlassProps<T>) {
  const Component = (as ?? 'div') as ElementType
  return (
    <Component
      className={cn('glass', strong && 'glass-strong', refract && 'glass-refract', className)}
      {...rest}
    />
  )
}
