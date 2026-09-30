import { type FormEvent, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { Button } from '@/components/button'
import { Field, Input } from '@/components/form'
import { errorMessage } from '@/lib/api'
import { useLogin } from '../queries'
import { AuthLayout } from './auth-layout'

export function LoginPage() {
  const [, navigate] = useLocation()
  const login = useLogin()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate({ username, password }, { onSuccess: () => navigate('/', { replace: true }) })
  }

  return (
    <AuthLayout title="家庭看板" subtitle="登录后查看全家的日程与清单">
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="用户名">
          <Input
            autoComplete="username"
            autoCapitalize="none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </Field>
        <Field label="密码">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {login.error ? <p className="text-sm text-danger">{errorMessage(login.error)}</p> : null}
        <Button type="submit" variant="primary" size="lg" loading={login.isPending}>
          登录
        </Button>
        <Link to="/kiosk" className="text-center text-sm text-fg-muted hover:text-fg">
          这是一块挂墙大屏？去配对
        </Link>
      </form>
    </AuthLayout>
  )
}
