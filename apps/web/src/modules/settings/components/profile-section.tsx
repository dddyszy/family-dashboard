import type { Me } from '@shared/schemas/users'
import { Camera } from 'lucide-react'
import { type FormEvent, useRef, useState } from 'react'
import { Button } from '@/components/button'
import { Field, Input } from '@/components/form'
import { Glass } from '@/components/glass'
import { Avatar, Section } from '@/components/misc'
import { errorMessage } from '@/lib/api'
import { useUpdateMe } from '@/modules/auth/queries'
import { toast } from '@/stores/ui'
import { settingsApi } from '../api'
import { ColorPicker } from './color-picker'

export function ProfileSection({ user }: { user: Me }) {
  const updateMe = useUpdateMe()
  const [name, setName] = useState(user.name)
  const [color, setColor] = useState(user.color)
  const [passwords, setPasswords] = useState({ current: '', next: '' })
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const saveProfile = (e: FormEvent) => {
    e.preventDefault()
    updateMe.mutate(
      { name, color },
      {
        onSuccess: () => toast.success('已保存'),
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  const changePassword = (e: FormEvent) => {
    e.preventDefault()
    updateMe.mutate(
      { currentPassword: passwords.current, newPassword: passwords.next },
      {
        onSuccess: () => {
          setPasswords({ current: '', next: '' })
          toast.success('密码已修改')
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  const uploadAvatar = async (file: File) => {
    setUploading(true)
    try {
      const { url } = await settingsApi.upload(file)
      await updateMe.mutateAsync({ avatar: url })
      toast.success('头像已更新')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Glass className="p-5">
        <Section title="个人资料">
          <form className="flex flex-col gap-4" onSubmit={saveProfile}>
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="group relative"
                onClick={() => fileRef.current?.click()}
                aria-label="更换头像"
              >
                <Avatar user={{ ...user, color }} size={64} />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100">
                  <Camera className="size-5 text-white" />
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void uploadAvatar(file)
                  e.target.value = ''
                }}
              />
              <div className="text-sm text-fg-muted">
                <p>用户名：{user.username}</p>
                {user.avatar ? (
                  <button
                    type="button"
                    className="mt-1 text-danger hover:underline"
                    onClick={() => updateMe.mutate({ avatar: null })}
                    disabled={uploading}
                  >
                    移除头像
                  </button>
                ) : null}
              </div>
            </div>
            <Field label="名字">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={32}
                required
              />
            </Field>
            <Field label="我的颜色" hint="日程和清单中用这个颜色标识你">
              <ColorPicker value={color} onChange={setColor} />
            </Field>
            <div>
              <Button type="submit" variant="primary" loading={updateMe.isPending}>
                保存
              </Button>
            </div>
          </form>
        </Section>
      </Glass>
      <Glass className="p-5">
        <Section title="修改密码">
          <form className="flex flex-col gap-4" onSubmit={changePassword}>
            <Field label="当前密码">
              <Input
                type="password"
                autoComplete="current-password"
                value={passwords.current}
                onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
                required
              />
            </Field>
            <Field label="新密码" hint="至少 6 位">
              <Input
                type="password"
                autoComplete="new-password"
                value={passwords.next}
                onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))}
                minLength={6}
                required
              />
            </Field>
            <div>
              <Button type="submit" loading={updateMe.isPending}>
                修改密码
              </Button>
            </div>
          </form>
        </Section>
      </Glass>
    </div>
  )
}
