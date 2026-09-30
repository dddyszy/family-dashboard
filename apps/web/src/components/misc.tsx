import type { PublicUser } from '@shared/schemas/users'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Avatar({
  user,
  size = 32,
  className,
}: {
  user: Pick<PublicUser, 'name' | 'avatar' | 'color'>
  size?: number
  className?: string
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) }
  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.name}
        style={style}
        className={cn('shrink-0 rounded-full object-cover ring-2 ring-white/40', className)}
      />
    )
  }
  return (
    <span
      style={{ ...style, background: user.color }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white/40',
        className,
      )}
      title={user.name}
    >
      {user.name.slice(0, 1)}
    </span>
  )
}

export function AvatarStack({ users, size = 22 }: { users: PublicUser[]; size?: number }) {
  return (
    <span className="flex -space-x-1.5">
      {users.slice(0, 4).map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
    </span>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-2 py-10 text-center', className)}
    >
      <Icon className="size-9 text-fg-subtle" strokeWidth={1.5} />
      <p className="font-medium text-fg-muted">{title}</p>
      {description ? <p className="max-w-xs text-sm text-fg-subtle">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-fg-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-fg-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}
