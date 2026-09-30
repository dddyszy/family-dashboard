import { Sparkles } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/button'
import { Input } from '@/components/form'
import { useParseQuickEntry } from '../queries'
import { useCalendarUi } from '../store'

/** One-line natural language entry; the parsed draft opens in the editor for confirmation. */
export function QuickEntry({ className }: { className?: string }) {
  const [text, setText] = useState('')
  const parse = useParseQuickEntry()
  const openEditor = useCalendarUi((s) => s.openEditor)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    parse.mutate(value, {
      onSuccess: (draft) => {
        openEditor({ kind: 'new', draft })
        setText('')
      },
    })
  }

  return (
    <form className={className} onSubmit={submit}>
      <div className="relative flex gap-2">
        <Sparkles className="pointer-events-none absolute top-3 left-3 size-4 text-accent" />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="一句话添加：明天下午3点 家长会 提前1小时 @妈妈"
          className="pl-9"
          aria-label="快捷添加日程"
        />
        <Button type="submit" variant="primary" loading={parse.isPending} disabled={!text.trim()}>
          添加
        </Button>
      </div>
    </form>
  )
}
