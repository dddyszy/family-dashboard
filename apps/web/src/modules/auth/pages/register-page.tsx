import { registerInput } from '@shared/schemas/users'
import { type ChangeEvent, type FormEvent, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { Button } from '@/components/button'
import { Field, Input } from '@/components/form'
import { errorMessage } from '@/lib/api'
import { useAuthStatus, useRegister } from '../queries'
import { AuthLayout } from './auth-layout'

export function RegisterPage() {
  const [, navigate] = useLocation()
  const register = useRegister()
  const status = useAuthStatus(true)
  const [form, setForm] = useState({ name: '', username: '', password: '', confirm: '' })
  const [localError, setLocalError] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (register.isPending) return
    if (form.password !== form.confirm) {
      setLocalError('两次输入的密码不一致')
      return
    }
    const result = registerInput.safeParse(form)
    if (!result.success) {
      setLocalError(result.error.issues[0]?.message ?? '请检查注册信息')
      return
    }
    setLocalError('')
    register.mutate(result.data, { onSuccess: () => navigate('/', { replace: true }) })
  }

  const update = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((previous) => ({ ...previous, [key]: event.target.value }))
    setLocalError('')
    register.reset()
  }

  if (status.data && !status.data.registrationOpen) {
    return (
      <AuthLayout title="暂未开放注册" subtitle="请联系家庭管理员为你添加账号">
        <Link to="/login" className="block text-center text-sm text-accent hover:underline">
          返回登录
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="注册家庭成员" subtitle="创建普通成员账号，加入家庭看板">
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="你的名字" hint="例如：爸爸、妈妈">
          <Input
            value={form.name}
            onChange={update('name')}
            autoComplete="nickname"
            disabled={register.isPending}
            required
            maxLength={32}
          />
        </Field>
        <Field label="用户名" hint="2–32 位字母、数字或下划线，用于登录">
          <Input
            value={form.username}
            onChange={update('username')}
            autoCapitalize="none"
            autoComplete="username"
            spellCheck={false}
            disabled={register.isPending}
            required
            minLength={2}
            maxLength={32}
          />
        </Field>
        <Field label="密码" hint="至少 6 位">
          <Input
            type="password"
            value={form.password}
            onChange={update('password')}
            autoComplete="new-password"
            disabled={register.isPending}
            required
            minLength={6}
            maxLength={128}
          />
        </Field>
        <Field label="确认密码">
          <Input
            type="password"
            value={form.confirm}
            onChange={update('confirm')}
            autoComplete="new-password"
            disabled={register.isPending}
            required
            minLength={6}
            maxLength={128}
          />
        </Field>
        {localError || register.error ? (
          <p role="alert" className="text-sm text-danger">
            {localError || errorMessage(register.error)}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" loading={register.isPending}>
          注册并进入
        </Button>
        <Link to="/login" className="text-center text-sm text-accent hover:underline">
          已有账号？去登录
        </Link>
      </form>
    </AuthLayout>
  )
}
