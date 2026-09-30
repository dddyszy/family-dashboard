import { type FormEvent, useState } from 'react'
import { useLocation } from 'wouter'
import { Button } from '@/components/button'
import { Field, Input } from '@/components/form'
import { errorMessage } from '@/lib/api'
import { useSetup } from '../queries'
import { AuthLayout } from './auth-layout'

export function SetupPage() {
  const [, navigate] = useLocation()
  const setup = useSetup()
  const [form, setForm] = useState({ name: '', username: '', password: '', confirm: '' })
  const [localError, setLocalError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setLocalError('两次输入的密码不一致')
      return
    }
    setLocalError('')
    setup.mutate(
      { name: form.name, username: form.username, password: form.password },
      { onSuccess: () => navigate('/', { replace: true }) },
    )
  }

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <AuthLayout title="欢迎使用家庭看板" subtitle="先创建一个管理员账号，之后可以添加其他家庭成员">
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="你的名字" hint="例如：爸爸、妈妈">
          <Input value={form.name} onChange={update('name')} required maxLength={32} />
        </Field>
        <Field label="用户名" hint="登录用，字母、数字或下划线">
          <Input
            value={form.username}
            onChange={update('username')}
            autoCapitalize="none"
            autoComplete="username"
            required
          />
        </Field>
        <Field label="密码" hint="至少 6 位">
          <Input
            type="password"
            value={form.password}
            onChange={update('password')}
            autoComplete="new-password"
            required
          />
        </Field>
        <Field label="确认密码">
          <Input
            type="password"
            value={form.confirm}
            onChange={update('confirm')}
            autoComplete="new-password"
            required
          />
        </Field>
        {localError || setup.error ? (
          <p className="text-sm text-danger">{localError || errorMessage(setup.error)}</p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" loading={setup.isPending}>
          创建并进入
        </Button>
      </form>
    </AuthLayout>
  )
}
