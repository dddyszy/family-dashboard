import { LayoutGrid } from 'lucide-react'
import type { ReactNode } from 'react'
import { Glass } from '@/components/glass'

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-5">
      <Glass refract className="w-full max-w-sm p-7 animate-pop-in">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="glass inline-flex size-16 items-center justify-center rounded-[20px]">
            <LayoutGrid className="size-8 text-accent" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>
          </div>
        </div>
        {children}
      </Glass>
    </div>
  )
}
