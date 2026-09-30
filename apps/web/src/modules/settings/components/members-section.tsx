import type { PublicUser } from '@shared/schemas/users'
import { Plus, Trash2, UserCog } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/button'
import { Field, Input, Segmented } from '@/components/form'
import { Glass } from '@/components/glass'
import { Avatar, Section } from '@/components/misc'
import { ConfirmDialog, Modal } from '@/components/overlay'
import { errorMessage } from '@/lib/api'
import { toast } from '@/stores/ui'
import { useCreateMember, useDeleteMember, useMembers, useUpdateMember } from '../queries'
import { ColorPicker } from './color-picker'

export function MembersSection({ currentUserId }: { currentUserId: string }) {
  const { data: members = [] } = useMembers()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<PublicUser | null>(null)
  const [deleting, setDeleting] = useState<PublicUser | null>(null)
  const remove = useDeleteMember()

  return (
    <Glass className="p-5">
      <Section
        title="家庭成员"
        description="每位成员用自己的账号登录，数据可以设为私有或家庭共享"
        actions={
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            添加成员
          </Button>
        }
      >
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-3">
              <Avatar user={m} size={40} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {m.name}
                  {m.id === currentUserId ? (
                    <span className="ml-2 text-xs text-fg-subtle">（我）</span>
                  ) : null}
                </p>
                <p className="text-sm text-fg-muted">
                  {m.username} · {m.role === 'admin' ? '管理员' : '成员'}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setEditing(m)}
                aria-label={`编辑${m.name}`}
              >
                <UserCog className="size-4" />
              </Button>
              {m.id !== currentUserId ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setDeleting(m)}
                  aria-label={`删除${m.name}`}
                >
                  <Trash2 className="size-4 text-danger" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>
      <CreateMemberModal open={creating} onOpenChange={setCreating} />
      {editing ? <EditMemberModal member={editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`删除成员「${deleting?.name ?? ''}」？`}
        description="该成员创建的私有数据会一并删除，此操作无法撤销。"
        actions={
          <>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                deleting &&
                remove.mutate(deleting.id, {
                  onSuccess: () => setDeleting(null),
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              删除
            </Button>
            <Button onClick={() => setDeleting(null)}>取消</Button>
          </>
        }
      />
    </Glass>
  )
}

function CreateMemberModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const create = useCreateMember()
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'member' as 'member' | 'admin',
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate(form, {
      onSuccess: () => {
        toast.success('已添加成员')
        setForm({ name: '', username: '', password: '', role: 'member' })
        onOpenChange(false)
      },
    })
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="添加家庭成员">
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="名字">
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </Field>
        <Field label="用户名" hint="登录用，字母、数字或下划线">
          <Input
            value={form.username}
            autoCapitalize="none"
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </Field>
        <Field label="初始密码" hint="至少 6 位，成员登录后可以自行修改">
          <Input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </Field>
        <Field label="角色">
          <Segmented
            value={form.role}
            onChange={(role) => setForm({ ...form, role })}
            options={[
              { value: 'member', label: '成员' },
              { value: 'admin', label: '管理员' },
            ]}
          />
        </Field>
        {create.error ? <p className="text-sm text-danger">{errorMessage(create.error)}</p> : null}
        <Button type="submit" variant="primary" loading={create.isPending}>
          添加
        </Button>
      </form>
    </Modal>
  )
}

function EditMemberModal({ member, onClose }: { member: PublicUser; onClose: () => void }) {
  const update = useUpdateMember()
  const [name, setName] = useState(member.name)
  const [color, setColor] = useState(member.color)
  const [role, setRole] = useState(member.role)
  const [password, setPassword] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    update.mutate(
      { id: member.id, input: { name, color, role, ...(password ? { password } : {}) } },
      {
        onSuccess: () => {
          toast.success('已保存')
          onClose()
        },
      },
    )
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={`编辑 ${member.name}`}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="名字">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="颜色">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
        <Field label="角色">
          <Segmented
            value={role}
            onChange={setRole}
            options={[
              { value: 'member', label: '成员' },
              { value: 'admin', label: '管理员' },
            ]}
          />
        </Field>
        <Field label="重置密码" hint="留空则不修改；重置后该成员需要重新登录">
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {update.error ? <p className="text-sm text-danger">{errorMessage(update.error)}</p> : null}
        <Button type="submit" variant="primary" loading={update.isPending}>
          保存
        </Button>
      </form>
    </Modal>
  )
}
