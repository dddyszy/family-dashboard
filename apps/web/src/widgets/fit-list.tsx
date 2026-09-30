import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Shows as many whole rows as fit the remaining card height and hides the rest, without
 * measuring. Rows flow down a column-wrapping flexbox; rows that do not fit wrap into further
 * columns, which sit outside the clipped area. `columns` sets how many columns stay visible.
 */
export function FitList({
  children,
  columns = 1,
  className,
}: {
  children: ReactNode
  columns?: 1 | 2
  className?: string
}) {
  return (
    <ul
      className={cn(
        'flex min-h-0 flex-1 flex-col flex-wrap content-start gap-x-0 overflow-hidden',
        columns === 1 ? '[&>*]:w-full' : '[&>*]:w-1/2 [&>*]:pr-3',
        className,
      )}
    >
      {children}
    </ul>
  )
}
