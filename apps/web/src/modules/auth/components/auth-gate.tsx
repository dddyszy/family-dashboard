import type { ReactNode } from 'react'
import { Redirect } from 'wouter'
import { Button, Spinner } from '@/components/button'
import { errorMessage } from '@/lib/api'
import { AuthLayout } from '../pages/auth-layout'
import { useAuthStatus, useMe } from '../queries'

export function AuthGate({ mode, children }: { mode: 'setup' | 'sign-in'; children: ReactNode }) {
  const me = useMe()
  const status = useAuthStatus(me.data?.kind === 'anonymous')

  if (me.data?.kind === 'user') return <Redirect to="/" replace />
  if (me.data?.kind === 'device') return <Redirect to="/kiosk" replace />
  if (me.isError || status.isError) {
    return (
      <AuthLayout title="暂时无法连接" subtitle="请检查网络后重试">
        <div className="flex flex-col gap-4">
          <p role="alert" className="text-sm text-danger">
            {errorMessage(me.error ?? status.error)}
          </p>
          <Button
            loading={me.isFetching || status.isFetching}
            onClick={() => {
              void me.refetch()
              if (me.data?.kind === 'anonymous') void status.refetch()
            }}
          >
            重试
          </Button>
        </div>
      </AuthLayout>
    )
  }
  if (me.isPending || status.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="加载中">
        <Spinner className="size-7 text-fg-muted" />
      </div>
    )
  }
  if (!status.data.initialized && mode !== 'setup') return <Redirect to="/setup" replace />
  if (status.data.initialized && mode === 'setup') return <Redirect to="/login" replace />
  return children
}
