import { RESET_CONFIRM_PHRASE, type ResetMode } from '@shared/schemas/admin'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, TriangleAlert, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/button'
import { Field, Input, Segmented } from '@/components/form'
import { Glass } from '@/components/glass'
import { Section } from '@/components/misc'
import { Modal } from '@/components/overlay'
import { errorMessage } from '@/lib/api'
import { clearClientCaches } from '@/lib/query-client'
import { disconnectRealtime } from '@/lib/realtime'
import { toast } from '@/stores/ui'
import { settingsApi } from '../api'

const SCOPES: Record<ResetMode, { removed: string[]; kept: string[] }> = {
  content: {
    removed: ['所有日程、待办和提醒', '所有购物清单和购买记录', '首页卡片布局（恢复为默认）'],
    kept: ['家庭成员账号和密码', '家庭设置、主题和壁纸', '已配对的大屏设备'],
  },
  factory: {
    removed: [
      '所有日程、待办、提醒和购物清单',
      '所有成员账号（包括你自己），所有人都会被登出',
      '家庭设置、大屏设备、上传的头像和壁纸',
    ],
    kept: ['重置前的自动备份（可在服务器 data/backups 目录找回）'],
  },
}

export function ResetSection() {
  const [open, setOpen] = useState(false)
  return (
    <Glass className="p-5">
      <Section title="危险操作" description="重置前会自动备份一次，备份出现在上方列表中">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-danger/10 p-4">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-danger" />
            <div>
              <p className="font-medium">重置数据</p>
              <p className="text-sm text-fg-muted">
                清空全家的日程、待办和购物清单，或恢复到刚安装时的状态
              </p>
            </div>
          </div>
          <Button variant="danger" onClick={() => setOpen(true)}>
            重置数据…
          </Button>
        </div>
      </Section>
      {open ? <ResetDialog onClose={() => setOpen(false)} /> : null}
    </Glass>
  )
}

function ResetDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<ResetMode>('content')
  const [confirm, setConfirm] = useState('')
  const [password, setPassword] = useState('')
  const reset = useMutation({
    mutationFn: () => settingsApi.reset({ mode, password, confirm: RESET_CONFIRM_PHRASE }),
    onSuccess: async (result) => {
      if (result.mode === 'factory') {
        disconnectRealtime()
        await clearClientCaches()
        window.location.replace('/setup')
        return
      }
      await qc.invalidateQueries()
      toast.success(result.backup ? `数据已清空，重置前的备份：${result.backup}` : '数据已清空')
      onClose()
    },
  })
  const ready = confirm.trim() === RESET_CONFIRM_PHRASE && password.length > 0
  const scope = SCOPES[mode]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (ready) reset.mutate()
  }

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="重置数据"
      description="此操作无法撤销，请仔细确认"
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Segmented
          value={mode}
          onChange={setMode}
          className="w-full [&>button]:flex-1"
          options={[
            { value: 'content', label: '清空数据' },
            { value: 'factory', label: '恢复出厂' },
          ]}
        />
        <div className="grid gap-3 rounded-2xl bg-surface p-4 text-sm">
          <ul className="flex flex-col gap-1.5">
            {scope.removed.map((item) => (
              <li key={item} className="flex gap-2">
                <X className="mt-0.5 size-4 shrink-0 text-danger" />
                <span>将删除：{item}</span>
              </li>
            ))}
          </ul>
          <ul className="flex flex-col gap-1.5">
            {scope.kept.map((item) => (
              <li key={item} className="flex gap-2 text-fg-muted">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                <span>将保留：{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <Field label={`请输入「${RESET_CONFIRM_PHRASE}」以确认`}>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="管理员密码">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        {reset.error ? <p className="text-sm text-danger">{errorMessage(reset.error)}</p> : null}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>取消</Button>
          <Button type="submit" variant="danger" disabled={!ready} loading={reset.isPending}>
            {mode === 'factory' ? '恢复出厂' : '清空数据'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
